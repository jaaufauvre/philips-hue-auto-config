import { Logger } from '../log/logger'
import fs from 'fs'
import Ajv from 'ajv'
import AjvKeywords from 'ajv-keywords'
import { ConfigGen, Light, MotionSensor, Room, Zone } from './config-gen'

class Config implements ConfigGen {
  private _internalConfig: ConfigGen
  lights: Light[]
  'motion-sensors'?: MotionSensor[]
  name?: string
  rooms: Room[]
  zones?: Zone[]

  print() {
    Logger.info(this._internalConfig)
  }

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
    this.validate()
    this.decrypt(xorKey)
    this.lights = this._internalConfig.lights
    this.rooms = this._internalConfig.rooms
    this.zones = this._internalConfig.zones
    this.name = this._internalConfig.name
    this['motion-sensors'] = this._internalConfig['motion-sensors']
  }

  private validate() {
    Logger.info(`Validating config '${this._internalConfig.name}' ...`)
    const ajv = new Ajv()
    AjvKeywords(ajv)
    const schema = JSON.parse(
      fs.readFileSync('./src/config/config-schema.json', 'utf-8'),
    )
    const isConfigValid = ajv.compile<Config>(schema)(this._internalConfig)
    if (!isConfigValid) {
      const errors = ajv.compile(schema).errors
      throw Error(`Config is invalid. Errors: ${Logger.toString(errors)}`)
    }
  }

  private decrypt(xorKey?: string) {
    if (!xorKey) {
      // Do nothing
      return
    }
    Logger.info(`Decrypting MAC and serial values with key: '${xorKey}' ...`)
    this._internalConfig.lights.forEach((light: Light) => {
      light.serial = this.decryptSerial(xorKey, light.serial)
      light.mac = this.decryptMac(xorKey, light.mac)
    })
    this._internalConfig['motion-sensors']?.forEach((sensor: MotionSensor) => {
      sensor.serial = this.decryptSerial(xorKey, sensor.serial)
      sensor.mac = this.decryptMac(xorKey, sensor.mac)
    })
  }

  // "ABCDEF" (lights) or "0BABCDEF" (sensors).
  // Only the 6 last hex numbers are encrypted.
  private decryptSerial(xorKey: string, serial?: string) {
    if (!serial) {
      // Do nothing
      return serial
    }
    let newSerial = serial.substring(0, serial.length - 6)
    let count: number = 0
    for (let i: number = serial.length - 6; i < serial.length; i++) {
      newSerial += this.decryptChar(
        xorKey.charAt(count % xorKey.length),
        serial.charAt(i),
      ).toUpperCase()
      count++
    }
    return newSerial
  }

  // "00:17:88:01:0c:ab:cd:ef-0b" (lights) or "00:17:88:01:0b:ab:cd:ef-02-0406"" (sensors).
  // Only the 6 last hex numbers are encrypted.
  private decryptMac(xorKey: string, mac: string) {
    let newMac = mac.substring(0, 15)
    let count: number = 0
    for (let i: number = 15; i < mac.indexOf('-'); i++) {
      const currentChar = mac.charAt(i)
      if (currentChar == ':') {
        newMac += ':'
        continue
      }
      newMac += this.decryptChar(
        xorKey.charAt(count % xorKey.length),
        currentChar,
      )
      count++
    }
    newMac += mac.substring(mac.indexOf('-'))
    return newMac
  }

  private decryptChar(keyChar: string, char: string) {
    return (parseInt(char, 16) ^ parseInt(keyChar, 16)).toString(16)
  }
}

export { Config, Light, MotionSensor, Room, Zone }
