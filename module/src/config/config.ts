import { Logger } from '../log/logger'
import fs from 'fs'
import Ajv from 'ajv'
import AjvKeywords from 'ajv-keywords'
import {
  ConfigGen,
  Bridge,
  Light,
  MotionSensor,
  TapDialSwitch,
  DimmerSwitch,
  WallSwitch,
  Room,
  Zone,
  Defaults,
} from './config-gen'
import _ from 'lodash'

interface Decryptable {
  mac: string
  serial?: string
}

interface ExtendedLight extends Light {
  idV1?: string
  idV2?: string
  ownerId?: string
}

interface ExtendedRoom extends Room {
  idV2?: string
}

interface ExtendedZone extends Zone {
  idV2?: string
}

interface ExtendedWallSwitch extends WallSwitch {
  idV1?: string
  idV2?: string
}

class Config implements ConfigGen {
  private _internalConfig: ConfigGen
  bridge: Bridge
  lights: ExtendedLight[]
  defaults: Defaults
  name?: string
  rooms: ExtendedRoom[]
  zones?: ExtendedZone[]
  motionSensors?: MotionSensor[]
  tapDialSwitches?: TapDialSwitch[]
  dimmerSwitches?: DimmerSwitch[]
  wallSwitches?: ExtendedWallSwitch[]

  constructor(configFilePath: any, xorKey?: string) {
    if (!configFilePath) {
      throw Error('No config provided. Use the --config option!')
    }
    if (!fs.existsSync(configFilePath)) {
      throw Error(configFilePath + ' not found!')
    }
    try {
      this._internalConfig = JSON.parse(
        fs.readFileSync(configFilePath, 'utf-8'),
      )
    } catch {
      throw Error('Could not parse config!')
    }
    this.#validate()
    this.bridge = this._internalConfig.bridge
    this.lights = this._internalConfig.lights
    this.defaults = this._internalConfig.defaults
    this.rooms = this._internalConfig.rooms
    this.zones = this._internalConfig.zones
    this.name = this._internalConfig.name
    this.motionSensors = this._internalConfig['motion-sensors']
    this.tapDialSwitches = this._internalConfig['tap-dial-switches']
    this.dimmerSwitches = this._internalConfig['dimmer-switches']
    this.wallSwitches = this._internalConfig['wall-switches']
    this.#decrypt(xorKey)
  }

  getResourceById(id: string) {
    return _.find(
      [
        _.find(this.lights, (light) =>
          _.includes([light.id, light.serial, light.mac], id),
        ),
        _.find(this.rooms, (room) => room.id === id),
        _.find(this.zones, (zone) => zone.id === id),
        _.find(this.wallSwitches, (wallSwitch) =>
          _.includes([wallSwitch.id, wallSwitch.mac], id),
        ),
      ],
      (resource) => resource !== undefined,
    )
  }

  getRoomLights(room: Room): ExtendedLight[] {
    return _.filter(this.lights, (light) => room.id === light.room)
  }

  getZoneLights(zone: Zone): ExtendedLight[] {
    return _.filter(this.lights, (light) => _.includes(light.zones, zone.id))
  }

  print() {
    const copy = _.cloneDeep(this)
    copy._internalConfig = JSON.parse('{}')
    Logger.debug(copy)
    Logger.info(`${copy.lights.length} light(s)`)
    Logger.info(`${copy.rooms.length} room(s)`)
    Logger.info(`${(copy.zones ?? []).length} zones(s)`)
    Logger.info(`${(copy.motionSensors ?? []).length} motion sensor(s)`)
    Logger.info(`${(copy.tapDialSwitches ?? []).length} tap dial switch(es)`)
    Logger.info(`${(copy.dimmerSwitches ?? []).length} dimmer switch(es)`)
    Logger.info(`${(copy.wallSwitches ?? []).length} wall switch(es)`)
  }

  #validate() {
    Logger.info(`Validating config '${this._internalConfig.name}' ...`)
    const ajv = new Ajv()
    AjvKeywords(ajv)
    const schema = JSON.parse(
      fs.readFileSync('./src/config/config-schema.json', 'utf-8'),
    )
    const isConfigValid = ajv.compile<Config>(schema)(this._internalConfig)
    if (!isConfigValid) {
      const errors = ajv.compile(schema).errors
      throw Error(
        `Config is invalid. Errors:${JSON.stringify(errors, null, 2)}`,
      )
    }
  }

  #decrypt(xorKey?: string) {
    if (!xorKey) {
      // Do nothing
      return
    }
    Logger.info(`Decrypting MAC and serial values with key: '${xorKey}' ...`)
    const objects = [
      ...this.lights,
      ...(this.motionSensors ?? []),
      ...(this.tapDialSwitches ?? []),
      ...(this.dimmerSwitches ?? []),
      ...(this.wallSwitches ?? []),
    ]
    objects.forEach((obj: Decryptable) => {
      obj.serial = this.#decryptSerial(xorKey, obj.serial)
      obj.mac = this.#decryptMac(xorKey, obj.mac)
    })
  }

  // Examples: "ABCDEF" (lights) or "0BABCDEF" (sensors).
  // Only the 6 last hex numbers are encrypted.
  #decryptSerial(xorKey: string, serial?: string) {
    if (!serial) {
      // Do nothing
      return serial
    }
    let newSerial = serial.substring(0, serial.length - 6)
    let count: number = 0
    for (let i: number = serial.length - 6; i < serial.length; i++) {
      newSerial += this.#decryptChar(
        xorKey.charAt(count % xorKey.length),
        serial.charAt(i),
      ).toUpperCase()
      count++
    }
    return newSerial
  }

  // Examples: "00:17:88:01:0c:ab:cd:ef-0b" (lights) or "00:17:88:01:0b:ab:cd:ef-02-0406" (sensors).
  // Only the 6 last hex numbers are encrypted.
  #decryptMac(xorKey: string, mac: string) {
    let newMac = mac.substring(0, 15)
    let count: number = 0
    for (let i: number = 15; i < mac.indexOf('-'); i++) {
      const currentChar = mac.charAt(i)
      if (currentChar == ':') {
        newMac += ':'
        continue
      }
      newMac += this.#decryptChar(
        xorKey.charAt(count % xorKey.length),
        currentChar,
      )
      count++
    }
    newMac += mac.substring(mac.indexOf('-'))
    return newMac
  }

  #decryptChar(keyChar: string, char: string) {
    return (parseInt(char, 16) ^ parseInt(keyChar, 16)).toString(16)
  }
}

export {
  Config,
  Light,
  MotionSensor,
  Room,
  Zone,
  ExtendedLight,
  ExtendedRoom,
  ExtendedZone,
  ExtendedWallSwitch,
}
