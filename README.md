![Logo](admin/netatmo-energy.png)
# ioBroker.netatmo-energy

[![NPM version](http://img.shields.io/npm/v/iobroker.netatmo-energy.svg)](https://www.npmjs.com/package/iobroker.netatmo-energy)
[![Downloads](https://img.shields.io/npm/dm/iobroker.netatmo-energy.svg)](https://www.npmjs.com/package/iobroker.netatmo-energy)
![Number of Installations (latest)](http://iobroker.live/badges/netatmo-energy-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/netatmo-energy-stable.svg)
[![Dependency Status](https://img.shields.io/david/Homemade-Disaster/iobroker.netatmo-energy.svg)](https://david-dm.org/Homemade-Disaster/iobroker.netatmo-energy)
[![Known Vulnerabilities](https://snyk.io/test/github/Homemade-Disaster/ioBroker.netatmo-energy/badge.svg)](https://snyk.io/test/github/Homemade-Disaster/ioBroker.netatmo-energy)

[![NPM](https://nodei.co/npm/iobroker.netatmo-energy.png?downloads=true)](https://nodei.co/npm/iobroker.netatmo-energy/)

**Tests:** ![Test and Release](https://github.com/Homemade-Disaster/ioBroker.netatmo-energy/workflows/Test%20and%20Release/badge.svg)

## Reqirements & configuration
	Netatmo Energy hardware (thermostat, valves)
	Account at Netatmo Cloud
	- Create your own account at https://auth.netatmo.com/de-de/access/signup
	- Login in site https://dev.netatmo.com/apidocumentation/energy
	- Create your own APP by clicking your account (top left), and press button "Create"
		- Fill out the form with your data
		- Copy your own client ID and client secret to the adapter config
		- Go back to the Documentation of Netatmo Energy API https://dev.netatmo.com/apidocumentation/energy
		- Select "GET homesdata" - "Try it out" - "EXECUTE / HOMESDATA"
			- you will get a response including your home id
			- copy it to your adapter config
		- insert your user and password from Netatmo Cloud to your adapter config
		- choose "generell settings options" and "Save and close" the adapter config


## netatmo-energy adapter for ioBroker

Get and set data using Netatmo-Energy API. This adapter uses the fetch command to execute http requests to Netatmo Energy API. The offical documentation of this API: https://dev.netatmo.com/apidocumentation/energy.

It also creates some checkboxes in the folder "SpecialRequests" to triggr API request by yourself.
1. homesdata_NAPlug      ... get the whole structure of your Netatmo energy environment (using NAPlug-Parameter)
2. homestatus            ... get the status and the tecnicl informations of your valves assigned in your rooms
3. setthermmode_schedule ... set the mode of your Netatmo Energy to schedule (default)
4. setthermmode_hq       ... set the mode of your Netatmo Energy to hq (freeze mode)
5. setthermmode_away     ... set the mode of your Netatmo Energy to away (from home)
6. applychanges          ... transfer all manually changes of your valves to Netatmo Energy

## Auto creation of objects

If you start the adapter it will be generating the actual "homes"-environment of your Netatmo Energy settings. It will automaticaly built up the whole structure, and the actual status of your valves.


## Changelog

### 0.0.1
* (IoKlausi) initial release

### 0.0.2
* (IoKlausi) Add API requests and automaticaly generation of home structure and documentation

## License
MIT License

Copyright (c) 2020 IoKlausi <nii@gmx.at>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.