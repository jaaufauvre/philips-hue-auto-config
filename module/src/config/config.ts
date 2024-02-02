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
  Scene,
} from './config-gen'
import _ from 'lodash'

interface Decryptable {
  mac: string
  serial?: string
}

interface Identifiable {
  id: string
}

export interface ExtendedLight extends Light {
  idV1?: string
  idV2?: string
  ownerId?: string
}

class ExtendedGroup {
  idV1?: string
  idV2?: string
  sceneIdsV1?: Map<Scene, string>
  sceneIdsV2?: Map<Scene, string>
  groupType?: string
}

export interface ExtendedRoom extends Room, ExtendedGroup {}

export interface ExtendedZone extends Zone, ExtendedGroup {}

export interface ExtendedWallSwitch extends WallSwitch {
  idV1?: string
  idV2?: string
}

export interface ExtendedTapDialSwitch extends TapDialSwitch {
  dialIdV1?: string
  switchIdV1?: string
  idV2?: string
}

export interface ExtendedDimmerSwitch extends DimmerSwitch {
  idV1?: string
  idV2?: string
}

export interface ExtendedMotionSensor extends MotionSensor {
  presenceIdV1?: string
  lightIdV1?: string
  temperatureIdV1?: string
  idV2?: string
}

class Config implements ConfigGen {
  private _internalConfig: ConfigGen
  bridge: Bridge
  lights: ExtendedLight[]
  defaults: Defaults
  name?: string
  rooms: ExtendedRoom[]
  zones: ExtendedZone[]
  motionSensors: ExtendedMotionSensor[]
  tapDialSwitches: ExtendedTapDialSwitch[]
  dimmerSwitches: ExtendedDimmerSwitch[]
  wallSwitches: ExtendedWallSwitch[]

  constructor(configFileOrJson: any, xorKey?: string) {
    if (!configFileOrJson) {
      throw Error('No config provided. Use the --config option!')
    }
    let content: string
    if (fs.existsSync(configFileOrJson)) {
      content = fs.readFileSync(configFileOrJson, 'utf-8')
    } else {
      content = configFileOrJson
    }
    try {
      this._internalConfig = JSON.parse(content)
    } catch {
      throw Error('Could not parse config!')
    }
    this.#validate()
    this.bridge = this._internalConfig.bridge
    this.lights = this._internalConfig.lights
    this.defaults = this._internalConfig.defaults
    this.rooms = this._internalConfig.rooms
    this.zones = this._internalConfig.zones ?? []
    this.name = this._internalConfig.name
    this.motionSensors = this._internalConfig['motion-sensors'] ?? []
    this.tapDialSwitches = this._internalConfig['tap-dial-switches'] ?? []
    this.dimmerSwitches = this._internalConfig['dimmer-switches'] ?? []
    this.wallSwitches = this._internalConfig['wall-switches'] ?? []
    _.forEach(this.rooms, (room) => (room.groupType = 'room'))
    _.forEach(this.zones, (zone) => (zone.groupType = 'zone'))
    _.forEach(_.concat<ExtendedGroup>(this.zones, this.rooms), (group) => {
      group.sceneIdsV1 = new Map<Scene, string>()
      group.sceneIdsV2 = new Map<Scene, string>()
    })
    this.#decrypt(xorKey)
    this.#validateUniqueIds()
    this.#validateLightConfig()
    this.#validateWallSwitchConfig()
    this.#validateTapDialSwitchConfig()
    this.#validateDimmerSwitchConfig()
    this.#validateMotionSensorConfig()
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
        _.find(this.tapDialSwitches, (tapDialSwitch) =>
          _.includes(
            [tapDialSwitch.id, tapDialSwitch.serial, tapDialSwitch.mac],
            id,
          ),
        ),
        _.find(this.dimmerSwitches, (dimmerSwitch) =>
          _.includes(
            [dimmerSwitch.id, dimmerSwitch.serial, dimmerSwitch.mac],
            id,
          ),
        ),
        _.find(this.motionSensors, (motionSensor) =>
          _.includes(
            [motionSensor.id, motionSensor.serial, motionSensor.mac],
            id,
          ),
        ),
      ],
      (resource) => resource !== undefined,
    )
  }

  getGroupLights(
    group: Room | Zone | ExtendedRoom | ExtendedZone,
  ): ExtendedLight[] {
    return _.filter(
      this.lights,
      (light) =>
        !light['smart-plug'] &&
        (group.id === light.room || _.includes(light.zones, group.id)),
    )
  }

  getGroupSmartPlugs(
    group: Room | Zone | ExtendedRoom | ExtendedZone,
  ): ExtendedLight[] {
    return _.filter(
      this.lights,
      (light) =>
        light['smart-plug'] === true &&
        (group.id === light.room || _.includes(light.zones, group.id)),
    )
  }

  print() {
    const copy = _.cloneDeep(this)
    copy._internalConfig = JSON.parse('{}')
    Logger.debug(copy)
    Logger.info(`${copy.lights.length} light(s)`)
    Logger.info(`${copy.rooms.length} room(s)`)
    Logger.info(`${copy.zones.length} zones(s)`)
    Logger.info(`${copy.motionSensors.length} motion sensor(s)`)
    Logger.info(`${copy.tapDialSwitches.length} tap dial switch(es)`)
    Logger.info(`${copy.dimmerSwitches.length} dimmer switch(es)`)
    Logger.info(`${copy.wallSwitches.length} wall switch(es)`)
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
        `Config is invalid. Errors: ${JSON.stringify(errors, null, 2)}`,
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
      ...this.motionSensors,
      ...this.tapDialSwitches,
      ...this.dimmerSwitches,
      ...this.wallSwitches,
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

  // Examples: "00:17:88:01:0c:ab:cd:ef-0b". Only the 6 last hex numbers are encrypted.
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

  #validateUniqueIds() {
    const all = _.concat<Identifiable>(
      this.lights,
      this.rooms,
      this.zones,
      this.tapDialSwitches,
      this.motionSensors,
      this.dimmerSwitches,
      this.wallSwitches,
    )
    if (all.length != _.uniqBy(all, (i) => i.id).length) {
      throw new Error('Identifiers must be unique!')
    }
  }

  #validateLightConfig() {
    this.lights.forEach((light) => {
      light.zones?.forEach((zone) => {
        this.#checkResourceDefined(zone)
      })
      this.#checkResourceDefined(light.room)
    })
  }

  #validateWallSwitchConfig() {
    this.wallSwitches.forEach((wallSwitch) => {
      this.#checkResourceDefined(wallSwitch.button1.group)
      if (wallSwitch.button2) {
        this.#checkResourceDefined(wallSwitch.button2.group)
      }
    })
  }

  #validateTapDialSwitchConfig() {
    this.tapDialSwitches.forEach((tapDialSwitch) => {
      this.#checkResourceDefined(tapDialSwitch.button1.group)
      this.#checkResourceDefined(tapDialSwitch.button2.group)
      this.#checkResourceDefined(tapDialSwitch.button3.group)
      this.#checkResourceDefined(tapDialSwitch.button4.group)
      this.#checkResourceDefined(tapDialSwitch.dial.group)
    })
  }

  #validateDimmerSwitchConfig() {
    this.dimmerSwitches.forEach((dimmerSwitch) => {
      this.#checkResourceDefined(dimmerSwitch.button1.group)
      this.#checkResourceDefined(dimmerSwitch.button2.group)
      this.#checkResourceDefined(dimmerSwitch.button3.group)
      this.#checkResourceDefined(dimmerSwitch.button4.group)
    })
  }

  #validateMotionSensorConfig() {
    this.motionSensors.forEach((motionSensor) => {
      this.#checkResourceDefined(motionSensor.group)
    })
    if (
      this.motionSensors.length > 0 &&
      (!this.defaults.scenes['motion-sensor-day'] ||
        !this.defaults.scenes['motion-sensor-night'])
    ) {
      throw new Error('Missing motion sensor scene definition!')
    }
  }

  #checkResourceDefined(id: string) {
    if (!this.getResourceById(id)) {
      throw Error(`Undefined identifier: '${id}'!`)
    }
  }
}

export { Config, Light, MotionSensor, Room, Zone }
