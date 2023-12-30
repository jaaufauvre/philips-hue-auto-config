import { HttpClient } from '../http/httpclient'
import https from 'https'
import fs from 'fs'
import { Logger } from '../log/logger'

export class ApiV2 {
  #bridgeIp
  #httpsClient

  constructor(bridgeIp: string, appKey: string) {
    this.#bridgeIp = bridgeIp
    this.#httpsClient = new HttpClient(
      new https.Agent({
        ca: fs.readFileSync('./src/res/signify-root.crt'), // Signify root CA, to verify the bridge certificate and avoid 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' errors
        checkServerIdentity: () => undefined, // Disable hostname verification to avoid 'ERR_TLS_CERT_ALTNAME_INVALID' errors (since we use the bridge IP address)
      }),
      {
        'hue-application-key': appKey,
      },
    )
  }

  #getBaseUrl = () => `https://${this.#bridgeIp}/clip/v2/resource`

  async createRoom(room: NewRoom): Promise<CreatedRooms> {
    Logger.info(
      `Creating room '${room.metadata.name}' on bridge ${this.#bridgeIp} ...`,
    )
    const uri = this.#getBaseUrl() + '/room'
    return await this.#httpsClient.post<CreatedRooms>(uri, room)
  }

  async getResources(): Promise<Resources> {
    Logger.info(`Retrieving resources on bridge ${this.#bridgeIp} ...`)
    return await this.#httpsClient.get<Resources>(this.#getBaseUrl())
  }

  async getRooms(): Promise<Rooms> {
    Logger.info(`Retrieving rooms on bridge ${this.#bridgeIp} ...`)
    const uri = this.#getBaseUrl() + '/room'
    return await this.#httpsClient.get<Rooms>(uri)
  }
}

//
// Rooms
//
export interface NewRoom {
  metadata: RoomMetadata
  type: 'room'
  children: RoomChild[]
}

export interface Rooms {
  errors: any[]
  data: CreatedRoom[]
}

export interface CreatedRoom {
  id: string
  id_v1: string
  children: RoomChild[]
  services: RoomChild[]
  metadata: RoomMetadata
  type: 'room'
}

export interface RoomChild {
  rid: string
  rtype: string
}

export interface RoomMetadata {
  name: string
  archetype: string
}

export interface CreatedRooms {
  data: CreatedRoom[]
  errors: any[]
}

export interface CreatedRoom {
  rid: string
  rtype: string
}

//
// Resources
//
export interface Resources {
  errors: any[]
  data: Resource[]
}

export interface Resource {
  id: string
  type: ResourceType
  metadata?: ResourceMetadata
}

export enum ResourceType {
  BehaviorInstance = 'behavior_instance',
  BehaviorScript = 'behavior_script',
  Bridge = 'bridge',
  BridgeHome = 'bridge_home',
  Button = 'button',
  Device = 'device',
  DevicePower = 'device_power',
  DeviceSoftwareUpdate = 'device_software_update',
  Entertainment = 'entertainment',
  EntertainmentConfiguration = 'entertainment_configuration',
  Geolocation = 'geolocation',
  GroupedLight = 'grouped_light',
  Homekit = 'homekit',
  Light = 'light',
  LightLevel = 'light_level',
  Matter = 'matter',
  Motion = 'motion',
  PublicImage = 'public_image',
  RelativeRotary = 'relative_rotary',
  Room = 'room',
  Scene = 'scene',
  Taurus7455 = 'taurus_7455',
  Temperature = 'temperature',
  ZigbeeConnectivity = 'zigbee_connectivity',
  ZigbeeDeviceDiscovery = 'zigbee_device_discovery',
  Zone = 'zone',
}

export interface ResourceMetadata {
  name?: string
  archetype?: string
}
