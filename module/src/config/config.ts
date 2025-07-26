import { Logger } from '../log/logger'
import fs from 'fs'
import Ajv from 'ajv'
import AjvKeywords from 'ajv-keywords'
import {
  AccessoryConfig,
  Bridge,
  ConfigGen,
  Convert,
  Defaults,
  DimmerSwitch,
  Light,
  LightAction,
  Mode,
  MotionSensor,
  Room,
  Scene,
  SmartButton,
  TapDialSwitch,
  WallSwitch,
  Zone,
} from './config-gen'
import _ from 'lodash'

interface Decryptable {
  mac: string
  serial?: string
}

interface Identifiable {
  id: string
}

export enum LightColorType {
  SoftWarmWhite = 'soft warm white',
  WarmToCoolWhite = 'warm to cool white',
  Colored = 'colored',
  Gradient = 'gradient',
}

export interface ExtendedLight extends Light {
  idV1?: string
  idV2?: string
  ownerId?: string
  colorType?: LightColorType
}

export enum GroupType {
  Room = 'room',
  Zone = 'zone',
}

class ExtendedGroup {
  idV1?: string
  idV2?: string
  sceneIdsV1?: Map<string, string>
  sceneIdsV2?: Map<string, string>
  groupType?: GroupType
}

export interface ExtendedRoom extends Room, ExtendedGroup {}

export interface ExtendedZone extends Zone, ExtendedGroup {}

export interface ExtendedWallSwitch extends WallSwitch {
  idV1?: string
  idV2?: string
}

export interface ExtendedSmartButton extends SmartButton {
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

export class Config implements ConfigGen {
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
  smartButtons: ExtendedSmartButton[]
  scenes: Scene[]
  lightActions: LightAction[]

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
    this.#validate(content)
    try {
      this._internalConfig = Convert.toConfigGen(content)
    } catch (e) {
      throw Error(`Couldn't load configuration: ${e}`)
    }
    this.bridge = this._internalConfig.bridge
    this.lights = this._internalConfig.lights
    this.defaults = this._internalConfig.defaults
    this.rooms = this._internalConfig.rooms
    this.zones = this._internalConfig.zones ?? []
    this.name = this._internalConfig.name
    this.motionSensors = this._internalConfig.motionSensors ?? []
    this.tapDialSwitches = this._internalConfig.tapDialSwitches ?? []
    this.dimmerSwitches = this._internalConfig.dimmerSwitches ?? []
    this.wallSwitches = this._internalConfig.wallSwitches ?? []
    this.smartButtons = this._internalConfig.smartButtons ?? []
    _.forEach(this.rooms, (room) => (room.groupType = GroupType.Room))
    _.forEach(this.zones, (zone) => (zone.groupType = GroupType.Zone))
    _.forEach(_.concat<ExtendedGroup>(this.zones, this.rooms), (group) => {
      group.sceneIdsV1 = new Map<string, string>()
      group.sceneIdsV2 = new Map<string, string>()
    })
    this.scenes = this._internalConfig.scenes ?? []
    this.lightActions = this._internalConfig.lightActions ?? []
    const defaultScenes = this.defaults.scenes
    _.forEach(
      [defaultScenes.day, defaultScenes.night, defaultScenes.evening],
      (sceneId) => {
        this.#checkSceneDefined(sceneId)
      },
    )
    this.#decrypt(xorKey)
    this.#validateUniqueIds()
    this.#validateLightConfig()
    this.#validateWallSwitchConfig()
    this.#validateSmartButtonConfig()
    this.#validateTapDialSwitchConfig()
    this.#validateDimmerSwitchConfig()
    this.#validateMotionSensorConfig()
    this.#validateSceneConfig()
  }

  getResourceById(id: string) {
    return _.find(
      [
        _.find(this.lights, (light) =>
          _.includes([light.id, light.serial, light.mac], id),
        ),
        _.find(this.rooms, { id }),
        _.find(this.zones, { id }),
        _.find(this.wallSwitches, (wallSwitch) =>
          _.includes([wallSwitch.id, wallSwitch.mac], id),
        ),
        _.find(this.smartButtons, (smartButton) =>
          _.includes([smartButton.id, smartButton.mac], id),
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
        _.find(this.lightActions, { id }),
        _.find(this.scenes, { id }),
      ],
      (resource) => resource !== undefined,
    )
  }

  getAllResourceMacs() {
    return _.map(
      _.concat<{
        mac: string
      }>(
        this.lights,
        this.motionSensors,
        this.dimmerSwitches,
        this.wallSwitches,
        this.smartButtons,
        this.tapDialSwitches,
      ),
      (resource) => resource.mac,
    )
  }

  getDaySceneId(config: AccessoryConfig) {
    return (
      config.scenes?.day ?? config.scenes?.unique ?? this.defaults.scenes.day
    )
  }

  getNightSceneId(config: AccessoryConfig) {
    return (
      config.scenes?.night ??
      config.scenes?.unique ??
      this.defaults.scenes.night
    )
  }

  getEveningSceneId(config: AccessoryConfig) {
    return (
      config.scenes?.evening ??
      config.scenes?.unique ??
      this.defaults.scenes.evening
    )
  }

  getGroupLights(
    group: Room | Zone | ExtendedRoom | ExtendedZone,
  ): ExtendedLight[] {
    return _.filter(
      this.lights,
      (light) => group.id === light.room || _.includes(light.zones, group.id),
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
    Logger.info(`${copy.smartButtons.length} smart button(s)`)
    Logger.info(`${copy.scenes.length} scene(s)`)
    Logger.info(`${copy.lightActions.length} light action(s)`)
  }

  #validate(content: string) {
    Logger.info(`Validating config ...`)
    const ajv = new Ajv()
    AjvKeywords(ajv)
    const schema = JSON.parse(
      fs.readFileSync('./src/config/config-schema.json', 'utf-8'),
    )
    const isConfigValid = ajv.compile<Config>(schema)(JSON.parse(content))
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
      ...this.smartButtons,
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
      this.smartButtons,
      this.scenes,
      this.lightActions,
    )
    if (all.length != _.uniqBy(all, (i) => i.id).length) {
      throw new Error('Identifiers must be unique!')
    }
  }

  #validateLightConfig() {
    this.lights.forEach((light) => {
      light.zones?.forEach((zone) => {
        this.#checkZoneDefined(zone)
      })
      this.#checkRoomDefined(light.room)
    })
  }

  #validateWallSwitchConfig() {
    this.wallSwitches.forEach((wallSwitch) => {
      this.#checkAccessoryConfig(wallSwitch.button1)
      this.#checkAccessoryConfig(wallSwitch.button2)
      this.#checkWallSwitchMode(wallSwitch)
    })
  }

  #validateSmartButtonConfig() {
    this.smartButtons.forEach((smartButton) => {
      this.#checkAccessoryConfig(smartButton.button)
    })
  }

  #validateTapDialSwitchConfig() {
    this.tapDialSwitches.forEach((tapDialSwitch) => {
      this.#checkAccessoryConfig(tapDialSwitch.button1)
      this.#checkAccessoryConfig(tapDialSwitch.button2)
      this.#checkAccessoryConfig(tapDialSwitch.button3)
      this.#checkAccessoryConfig(tapDialSwitch.button4)
      this.#checkAccessoryConfig(tapDialSwitch.dial)
    })
  }

  #validateDimmerSwitchConfig() {
    this.dimmerSwitches.forEach((dimmerSwitch) => {
      this.#checkAccessoryConfig(dimmerSwitch.button1)
      this.#checkAccessoryConfig(dimmerSwitch.button2)
      this.#checkAccessoryConfig(dimmerSwitch.button3)
      this.#checkAccessoryConfig(dimmerSwitch.button4)
    })
  }

  #validateMotionSensorConfig() {
    this.motionSensors.forEach((motionSensor) => {
      this.#checkAccessoryConfig(motionSensor.motion)
    })
  }

  #validateSceneConfig() {
    this.scenes.forEach((scene) => {
      scene.groups?.forEach((group) => {
        this.#checkGroupDefined(group)
      })
      scene.actions?.forEach((action) => {
        this.#checkLightDefined(action.target)
        this.#checkResourceDefined(action.lightAction)
      })
      scene.colorAmbianceActions?.forEach((actionId) => {
        this.#checkResourceDefined(actionId)
      })
      this.#checkResourceDefined(scene.whiteAmbianceAction)
      this.#checkResourceDefined(scene.whiteAction)
    })
  }

  #checkWallSwitchMode(wallSwitch: ExtendedWallSwitch) {
    switch (wallSwitch.mode) {
      case Mode.SwitchSingleRocker:
        if (wallSwitch.button2)
          throw new Error(
            `Unexpected button 2 configuration for '${wallSwitch.name}'!`,
          )
        break
      case Mode.SwitchDualRocker:
        if (!wallSwitch.button2)
          throw new Error(
            `Missing button 2 configuration for '${wallSwitch.name}'!`,
          )
        break
    }
  }

  #checkAccessoryConfig(config: AccessoryConfig | undefined) {
    if (!config) {
      return
    }
    config.groups.forEach((group) => {
      this.#checkGroupDefined(group)
    })
    this.#checkSceneDefined(config.scenes?.day)
    this.#checkSceneDefined(config.scenes?.night)
    this.#checkSceneDefined(config.scenes?.evening)
    this.#checkSceneDefined(config.scenes?.unique)
  }

  #checkResourceDefined(id: string | undefined) {
    if (!id) {
      return
    }
    if (!this.getResourceById(id)) {
      throw Error(`Undefined resource identifier: '${id}'!`)
    }
  }

  #checkGroupDefined(id: string) {
    if (!_.find(_.concat(this.zones, this.rooms), { id })) {
      throw Error(`Undefined group identifier: '${id}'!`)
    }
  }

  #checkZoneDefined(id: string) {
    if (!_.find(this.zones, { id })) {
      throw Error(`Undefined zone identifier: '${id}'!`)
    }
  }

  #checkRoomDefined(id: string) {
    if (!_.find(this.rooms, { id })) {
      throw Error(`Undefined room identifier: '${id}'!`)
    }
  }

  #checkLightDefined(id: string) {
    if (!_.find(this.lights, { id })) {
      throw Error(`Undefined light identifier: '${id}'!`)
    }
  }

  #checkSceneDefined(id: string | undefined) {
    if (!id) {
      return
    }
    if (!_.find(this.scenes, { id })) {
      throw Error(`Undefined scene identifier: '${id}'!`)
    }
  }
}
