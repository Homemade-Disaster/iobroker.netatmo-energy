'use strict';

/*
 * Created with @iobroker/create-adapter v1.31.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter

const utils = require('@iobroker/adapter-core');
const fetch = require('fetch');

const APIRequest_homesdata                = 'homesdata';
const APIRequest_homesdata_NAPlug         = 'NAPlug';

const APIRequest_homestatus               = 'homestatus';

const APIRequest_setroomthermpoint        = 'setroomthermpoint';
const APIRequest_setroomthermpoint_manual = 'manual';

const APIRequest_setthermmode_schedule    = 'schedule';
const APIRequest_setthermmode_hg          = 'hg';
const APIRequest_setthermmode_away        = 'away';

const APIRequest_setthermmode             = 'setthermmode';
// Load your modules here, e.g.:
// const fs = require("fs");

class NetatmoEnergy extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'netatmo-energy',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		//this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
		this.globalRefreshToken = '';
		this.globalNetatmo_ExpiresIn = 0;
		this.globalNetatmo_AccessToken = '';
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		await this.sendAPIRequest(APIRequest_homesdata, '&gateway_types=' + APIRequest_homesdata_NAPlug);
		this.log.info('API Request homesdata: done');
		await this.sendAPIRequest(APIRequest_homestatus, '');
		this.log.info('API Request homestatus: done');
	}

	// Send API inkluding tokenrequest
	async sendAPIRequest(APIRequest, setpayload) {
		let globalresponse = null;
		const Netatmo_Path = this.name + '.' + this.instance;

		this.log.info('API Request: ' + APIRequest + '?' + setpayload);
		await this.getToken(this.config.HomeId,this.config.ClientId,this.config.ClientSecretID,this.config.User,this.config.Password)
			.then(tokenvalues => {
				this.globalNetatmo_AccessToken = tokenvalues.access_token;
				this.globalNetatmo_ExpiresIn = tokenvalues.expires_in;
				this.globalRefreshToken = tokenvalues.refresh_token;
			})
			.catch(error => {
				this.globalRefreshToken = '';
				this.globalNetatmo_ExpiresIn = 0;
				this.log.debug('Did not get a tokencode: ' + error.error + ': ' + error.error_description);
			});

		await this.getAPIRequest(APIRequest,setpayload)
			.then(response => {
				globalresponse = response;
			})
			.catch(error => {
				this.log.info('API request not OK: ' + error.error + ': ' + error.error_description);
			});
		if (globalresponse) {
			if (APIRequest == APIRequest_homesdata || APIRequest == APIRequest_homestatus) {
				this.log.debug('Parse result' +  APIRequest);
				await this.GetValuesFromNetatmo(APIRequest,globalresponse,'','',Netatmo_Path);
			} else {
				this.log.debug('API Changes applied' +  APIRequest);
			}
		}
		this.log.debug('API request finished' );
	}

	//get token from Netatmo
	getToken(HomeId,ClientId,ClientSecretID,User,Password) {
		this.log.debug('FETCH: Get Token');
		this.globalNetatmo_AccessToken = '';

		let payload = '';
		if (!this.globalRefreshToken) {
			payload = 'grant_type=password&client_id=' + ClientId + '&client_secret=' + ClientSecretID + '&username=' + User + '&password=' + Password + '&scope=read_thermostat write_thermostat';
		} else {
			payload  = 'grant_type=refresh_token&refresh_token=' + this.globalRefreshToken + '&client_id=' + ClientId + '&client_secret=' + ClientSecretID;
		}
		return this.myFetch('https://api.netatmo.net/oauth2/token',payload);
	}

	//API request main routine
	getAPIRequest(NetatmoRequest, extend_payload) {
		this.log.debug('FETCH: Get API Request ' + NetatmoRequest + ' / ' + extend_payload);
		const payload = 'access_token=' + this.globalNetatmo_AccessToken + '&home_id=' + this.config.HomeId + extend_payload;
		return this.myFetch('https://api.netatmo.com/api/' + NetatmoRequest, payload);
	}

	//Send Changes to API
	async ApplyAPIRequest (NetatmoRequest,mode) {
		const that = this;
		const searchstring = 'rooms\\.\\d+\\.settings\\.TempChanged';
		let extend_payload = '';

		switch (NetatmoRequest) {
			case APIRequest_setroomthermpoint:
				this.getStates(this.name + '.' + this.instance + '.homes.*.rooms.*.settings.TempChanged',async function(error, states) {
					for(const id in states) {
						that.log.debug('Found TempChanges ID: ' + id);
						const adapterstates = await that.getStateAsync(id);

						if (id.search(searchstring) >= 0) {
							if (adapterstates && adapterstates.val === true) {
								await that.setState(id, false, true);

								const actPath = id.substring(0,id.lastIndexOf('.'));
								const actParent = actPath.substring(0,actPath.lastIndexOf('.'));
								const newTemp = await that.getStateAsync(actPath + '.SetTemp');
								that.log.debug('ActPath: ' + actPath);
								that.log.debug('ActParent: ' + actParent);
								that.log.debug('NewTemp: ' + actPath + '.SetTemp');
								if (newTemp) {
									that.applyactualtemp(newTemp,actPath,actParent,NetatmoRequest,extend_payload);
								}
							}
						}
					}
				});
				break;

			case APIRequest_setthermmode:
				extend_payload = '&mode=' + mode;
				await this.sendAPIRequest(NetatmoRequest, extend_payload);
				break;
		}
	}

	async applyactualtemp(newTemp,actPath,actParent,NetatmoRequest,mode) {
		this.log.debug('Check Roomnumber: ' + actParent + '.id');
		this.log.debug('Check actTemp: ' + actParent + '.status.therm_setpoint_temperature');

		const roomnumber = await this.getStateAsync(actParent + '.id');
		const actTemp = await this.getStateAsync(actParent + '.status.therm_setpoint_temperature');

		this.log.debug('Check act/new - Temp: ' + actTemp + ' - ' + newTemp);
		if (roomnumber && actTemp && actTemp.val != newTemp.val) {
			const extend_payload = '&room_id=' + roomnumber.val + '&mode=' + mode + '&temp=' + newTemp.val;
			this.log.debug('Send API Temp: ' + NetatmoRequest + ' - ' + extend_payload);
			await this.sendAPIRequest(NetatmoRequest, extend_payload);
		}
	}

	//fetch API request
	myFetch(url, payload) {

		this.log.debug('URL: ' + url);
		this.log.debug('Payload: ' + payload);

		const that = this;
		const promiseobject = new Promise(

			function(resolve,reject) {
				if (!url) {
					reject({error:'Invalid Parameter',error_description:'Url oder Payload wurde nicht übergeben!'});
					return;
				}
				fetch.fetchUrl(url, {
					method: 'POST',
					headers: {
						'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
					},
					payload: payload
				},
				function(error, meta, body) {
					that.log.debug('Netatmo Status:' + meta.status);
					if (meta.status == 200 ) {
						that.log.debug('Netatmo result:' + body);
						resolve(JSON.parse(body));
					} else {
						that.log.debug('Netatmo Error:' + body);
						reject(JSON.parse(body));
					}
				});
			});
		return  promiseobject;
	}

	//Parse values vrom Netatmo response
	async GetValuesFromNetatmo(API_Request,obj,obj_name,obj_selected,Netatmo_Path) {
		const relevantTag = 'home\\.\\b(?:rooms|modules)\\.\\d+\\.id';
		let myobj_selected = obj_name;

		if (this.NetatmoTags(obj_name) === true) {
			if (API_Request === APIRequest_homesdata) {
				await this.createMyChannel(Netatmo_Path, myobj_selected);
			}
		} else {
			myobj_selected = obj_selected;
		}

		for(const object_name in obj) {
			if (API_Request === APIRequest_homesdata && obj_selected === 'homes') {
				await this.createMyChannel(this.name + '.' + this.instance + '.SpecialRequests', myobj_selected);
				await this.CreateNetatmoStructure(this.name + '.' + this.instance + '.SpecialRequests.applychanges', 'Änderungen in die Netatmo Cloud übertragen', false,false,true);
				this.subscribeStates(this.name + '.' + this.instance + '.SpecialRequests.applychanges');
				await this.CreateNetatmoStructure(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_homesdata + '_' + APIRequest_homesdata_NAPlug, 'homesdata_NAPlug', false,false,true);
				this.subscribeStates(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_homesdata + '_' + APIRequest_homesdata_NAPlug);
				await this.CreateNetatmoStructure(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_homestatus, 'homesstatus', false,false,true);
				this.subscribeStates(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_homestatus);
				await this.CreateNetatmoStructure(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_setthermmode + '_' + APIRequest_setthermmode_schedule, 'SetThermMode_schedule', false,false,true);
				this.subscribeStates(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_setthermmode + '_' + APIRequest_setthermmode_schedule);
				await this.CreateNetatmoStructure(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_setthermmode + '_' + APIRequest_setthermmode_hg, 'SetThermMode_hg', false,false,true);
				this.subscribeStates(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_setthermmode + '_' + APIRequest_setthermmode_hg);
				await this.CreateNetatmoStructure(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_setthermmode + '_' + APIRequest_setthermmode_away, 'SetThermMode_away', false,false,true);
				this.subscribeStates(this.name + '.' + this.instance + '.SpecialRequests.'+ APIRequest_setthermmode + '_' + APIRequest_setthermmode_away);
			}
			if (API_Request === APIRequest_homestatus) {
				const fullname = this.getPrefixPath(Netatmo_Path + '.') + object_name;
				this.log.debug('Check Tag: ' + fullname + ' - ' + relevantTag + ' / ' + fullname.search(relevantTag));

				if (fullname.search(relevantTag) >= 0) {
					this.log.debug('Found Tag: ' + object_name);
					await this.SearchRoom(obj[object_name], obj);
				}
			}
			if(obj[object_name] instanceof Object) {
				if (this.NetatmoTags(object_name) === true) {
					await this.GetValuesFromNetatmo(API_Request,obj[object_name],object_name,myobj_selected,this.getPrefixPath(Netatmo_Path + '.') + object_name);
				} else {
					await this.GetValuesFromNetatmo(API_Request,obj[object_name],object_name,myobj_selected,Netatmo_Path);
				}
			} else {
				if (this.NetatmoTagsDetail(myobj_selected) === true && API_Request === APIRequest_homesdata) {
					await this.CreateNetatmoStructure(this.getPrefixPath(Netatmo_Path + '.') + object_name, object_name, obj[object_name],false,false);
				}
			}
		}
	}

	// homestatus in himedata-Datenpunkte einfügen
	async SearchRoom(statevalue,ObjStatus) {
		const searchRooms = 'homes\\.\\d+\\.rooms\\.\\d+\\.id';
		const searchModules = 'homes\\.\\d+\\.modules\\.\\d+\\.id';
		const that = this;
		let adapterstates = null;

		this.getStates(this.name + '.' + this.instance + '.homes.*.rooms.*',async function(error, states) {
			for(const id in states) {
				//that.log.debug('Search Objects: ' + id + ' - ' + searchRooms);

				if (id.search(searchRooms) >= 0) {
					that.log.debug('Found Room ID: ' + id);
					adapterstates = await that.getStateAsync(id);
					if (adapterstates && adapterstates.val == statevalue) {
						that.log.debug('Found Room: ' + adapterstates.val + ' = ' + statevalue);
						const myTargetName = id.substring(0,id.length - 3);
						that.log.debug('Found Room-TargetName: ' + myTargetName);
						await that.createMyChannel(myTargetName + '.status', 'Gerätestatus', '');

						for(const objstat_name in ObjStatus) {
							if(!(ObjStatus[objstat_name] instanceof Object) && objstat_name != 'id') {
								that.log.debug('Found homestatus room ids: ' + objstat_name + ' / ' + ObjStatus[objstat_name]);
								await that.CreateNetatmoStructure(myTargetName + '.status.' + objstat_name, objstat_name, ObjStatus[objstat_name],false,false);
								switch(objstat_name) {
									case 'therm_setpoint_temperature':
										that.log.debug('Create change states: ' + myTargetName + '.settings.SetTemp');
										await that.createMyChannel(myTargetName + '.settings', 'Einstellungen verändern');
										await that.CreateNetatmoStructure(myTargetName + '.settings.SetTemp', 'Temparatur manuell setzen', ObjStatus[objstat_name],false,true);
										that.subscribeStates(myTargetName + '.settings.SetTemp');
										await that.CreateNetatmoStructure(myTargetName + '.settings.TempChanged', 'Temparatur manuell geändert', false,false,false);
										break;
								}
							}
						}
						break;
					}
				}
			}
		});

		this.getStates(this.name + '.' + this.instance + '.homes.*.modules.*',async function(error, states) {
			for(const id in states) {
				//that.log.debug('Search Objects: ' + id + ' - ' + searchModules);

				if (id.search(searchModules) >= 0) {
					that.log.debug('Found Module ID: ' + id);
					adapterstates = await that.getStateAsync(id);
					if (adapterstates && adapterstates.val == statevalue) {
						that.log.debug('Found Module: ' + adapterstates.val + ' = ' + statevalue);
						const myTargetName = id.substring(0,id.length - 3);
						that.log.debug('Found Module-TargetName: ' + myTargetName);
						await that.createMyChannel(myTargetName + '.modulestatus', 'Gerätestatus', '');

						for(const objstat_name in ObjStatus) {
							if(!(ObjStatus[objstat_name] instanceof Object) && objstat_name != 'id') {
								that.log.debug('Found homestatus module ids: ' + objstat_name + ' / ' + ObjStatus[objstat_name]);
								await that.CreateNetatmoStructure(myTargetName + '.modulestatus.' + objstat_name, objstat_name, ObjStatus[objstat_name],false,false);
							}
						}
						break;
					}
				}
			}
		});
	}

	//Nicht Relevante Tags hinterlegen
	NetatmoTags(obj_name) {
		switch(obj_name) {
			case 'body':
				return false;
			case '':
				return false;
			default:
				return true;
		}
	}

	NetatmoTagsDetail(obj_name) {
		switch(obj_name) {
			case 'body':
				return false;
			default:
				return true;
		}
	}

	//Tools
	getPrefixPath(path) {
		return path.replace(/^\.+/, '');
	}

	// Create Channel
	async createMyChannel(path, name) {
		this.log.debug('Create Channel: ' + name + ' - ' + path);
		await this.setObjectNotExists(path, {
			type: 'channel',
			common: {
				name: name,
			},
			native: {},
		});
	}

	//dynamic creation of datapoints
	async CreateNetatmoStructure (id,object_name,value, ack, authority) {
		this.log.debug('Create State: ' + id + ' / ' + object_name + ' : ' + value);
		await this.setObjectNotExistsAsync(id, {
			type: 'state',
			common: {
				name: object_name,
				role: 'state',
				type: typeof value,
				read: true,
				write: authority
			},
			native: {},
		});
		await this.setState(id, value, ack);
	}

	async compareValues(id, state, idtoset) {
		const adapterstates = await this.getStateAsync(id);
		this.log.debug('Compare: ' + adapterstates.val + ' = ' + state.val);
		if(adapterstates.val != state.val ) {
			this.setState(idtoset, true, true);
		} else {
			this.setState(idtoset, false, true);
		}
	}
	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
			if (state.ack === true) {
				if (id.lastIndexOf('.') >= 0) {
					const actState = id.substring(id.lastIndexOf('.') + 1);
					const actPath = id.substring(0,id.lastIndexOf('.'));
					const actParent = actPath.substring(0,actPath.lastIndexOf('.'));
					this.log.debug('State: ' + actState);
					this.log.debug('Path: ' + actPath);
					this.log.debug('Parent: ' + actParent);
					switch(actState) {
						// Get Structure of your home
						case APIRequest_homesdata+ '_' + APIRequest_homesdata_NAPlug:
							this.log.debug('homesdata: ' + id + ' - ' + state.val);
							if (state.val === false) {
								break;
							}
							this.setState(id, false, true);
							this.sendAPIRequest(APIRequest_homesdata, '&gateway_types=' + APIRequest_homesdata_NAPlug);
							break;

						// get actual homestatus
						case APIRequest_homestatus:
							this.log.debug('homestatus: ' + id + ' - ' + state.val);
							if (state.val === false) {
								break;
							}
							this.setState(id, false, true);
							this.sendAPIRequest(APIRequest_homestatus, '');
							break;

						// Set Therm Mode for Netatmo Energy
						case 'SetTemp':
							this.log.debug('Start to check changes ' + state.val);
							if (!isNaN(state.val)) {
								this.log.debug('Immeaditly: ' + this.config.applyimmediately);
								if (this.config.applyimmediately) {
									this.log.debug('Call API directly');
									this.applyactualtemp(state,actPath,actParent,APIRequest_setroomthermpoint,APIRequest_setroomthermpoint_manual);
								} else {
									this.compareValues(actParent + '.status.therm_setpoint_temperature', state, actPath + '.TempChanged');
								}
							} else {
								this.log.debug('No Number ' + state.val);
							}
							break;

						// Apply all changes to Netatmo Cloud
						case 'applychanges':
							if (state.val === false) {
								break;
							}
							this.setState(id, false, true);
							this.ApplyAPIRequest(APIRequest_setroomthermpoint, APIRequest_setroomthermpoint_manual);
							break;

						// Set Therm Mode for Netatmo Energy
						case APIRequest_setthermmode + '_' + APIRequest_setthermmode_schedule:
							this.log.debug('schedule: ' + id + ' - ' + state.val);
							if (state.val === false) {
								break;
							}
							this.setState(id, false, true);
							this.ApplyAPIRequest(APIRequest_setthermmode, APIRequest_setthermmode_schedule);
							break;

						// Set Therm Mode for Netatmo Energy
						case APIRequest_setthermmode + '_' + APIRequest_setthermmode_hg:
							this.log.debug('hg: ' + id + ' - ' + state.val);
							if (state.val === false) {
								break;
							}
							this.setState(id, false, true);
							this.ApplyAPIRequest(APIRequest_setthermmode, APIRequest_setthermmode_hg);
							break;

						// Set Therm Mode for Netatmo Energy
						case APIRequest_setthermmode + '_' + APIRequest_setthermmode_away:
							this.log.debug('Away: ' + id + ' - ' + state.val);
							if (state.val === false) {
								break;
							}
							this.setState(id, false, true);
							this.ApplyAPIRequest(APIRequest_setthermmode, APIRequest_setthermmode_away);
							break;

					}
				}
			}

		} else {
			// The state was deleted
			//this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new NetatmoEnergy(options);
} else {
	// otherwise start the instance directly
	new NetatmoEnergy();
}