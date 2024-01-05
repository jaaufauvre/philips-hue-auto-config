# philips-hue-auto-config💡

[![](./res/idrKrdVpQk.svg)](https://www.philips-hue.com/)

## Overview

This project allows to describe and automatically restore a Philips Hue Bridge configuration.

It can be used to:
* Factory-reset a Hue Bridge and restore its previous configuration
* Move a configuration to another Hue Bridge 
* Split an existing configuration across two Hue Bridges

## Input configuration file

### Schema
* [config-schema.json](./module/src/config/config-schema.json)

### Examples
* [simple-config.json](./samples/simple-config.json)
* [bridge1-config.json](./samples/bridge1-config.json)
* [bridge2-config.json](./samples/bridge2-config.json)

## Run the program

1. Reset the Hue Bridge, then press the button in the centre of the Hue Bridge
2. Run: `cd module && npm install` 
3. Run: `npm run start --config=../samples/your-config.json`

Additional options:
* `--bridge=192.168.1.25` - Will skip Hue Bridge discovery and use the provided IP address instead
* `--appkey=AXYvXm9Bf5b…PZPW40TEM` - Will use the provided authentication key instead of creating a new one

## Program steps

The program will:

1. Load and check the JSON configuration
2. Search for the Hue Bridge
3. Create a Bridge user and authentication key
4. Delete bridge resources (if any)
5. Create rooms and zones
6. Search for lights (from their serial and MAC address) and add them to rooms and zones
7. Create a "Default" scene in each room and zone
8. Set a default power-on behavior for all lights

## References

* https://developers.meethue.com/develop/hue-api/
* https://developers.meethue.com/develop/hue-api-v2/