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
    Logger.info(`[API v2] Creating room '${room.metadata.name}' ...`)
    const uri = `${this.#getBaseUrl()}/room`
    return await this.#httpsClient.post<CreatedRooms>(uri, room)
  }

  async createZone(zone: NewZone): Promise<CreatedZones> {
    Logger.info(`[API v2] Creating zone '${zone.metadata.name}' ...`)
    const uri = `${this.#getBaseUrl()}/zone`
    return await this.#httpsClient.post<CreatedZones>(uri, zone)
  }

  async getRooms(): Promise<Rooms> {
    Logger.info(`[API v2] Retrieving rooms ...`)
    const uri = `${this.#getBaseUrl()}/room`
    return await this.#httpsClient.get<Rooms>(uri)
  }

  async getRoom(id: string): Promise<Rooms> {
    Logger.info(`[API v2] Retrieving room '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/room/${id}`
    return await this.#httpsClient.get<Rooms>(uri)
  }

  async updateRoom(id: string, room: UpdatedRoom) {
    Logger.info(`[API v2] Updating room '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/room/${id}`
    return await this.#httpsClient.put(uri, room)
  }

  async getZones(): Promise<Zones> {
    Logger.info(`[API v2] Retrieving zones ...`)
    const uri = `${this.#getBaseUrl()}/zone`
    return await this.#httpsClient.get<Zones>(uri)
  }

  async getZone(id: string): Promise<Zones> {
    Logger.info(`[API v2] Retrieving zone '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/zone/${id}`
    return await this.#httpsClient.get<Zones>(uri)
  }

  async updateZone(id: string, zone: UpdatedZone) {
    Logger.info(`[API v2] Updating zone '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/zone/${id}`
    return await this.#httpsClient.put(uri, zone)
  }

  async getLights() {
    Logger.info(`[API v2] Retrieving lights ...`)
    const uri = `${this.#getBaseUrl()}/light`
    return await this.#httpsClient.get<Lights>(uri)
  }
}

//
// Rooms
//
export interface NewRoom {
  metadata: RoomMetadata
  type: 'room'
  children: any[]
}

export interface Rooms {
  errors: any[]
  data: Room[]
}

export interface Room {
  id: string
  id_v1: string
  children: Resource[]
  services: any[]
  metadata: RoomMetadata
  type: 'room'
}

export interface UpdatedRoom {
  children: Resource[]
}

export interface RoomMetadata {
  name: string
  archetype: string
}

export interface CreatedRooms {
  data: Resource[]
  errors: any[]
}

//
// Zones
//
export interface NewZone {
  metadata: ZoneMetadata
  type: 'zone'
  children: any[]
}

export interface Zones {
  errors: any[]
  data: Zone[]
}

export interface Zone {
  id: string
  id_v1: string
  children: Resource[]
  services: any[]
  metadata: ZoneMetadata
  type: 'zone'
}

export interface UpdatedZone {
  children: Resource[]
}

export interface ZoneMetadata {
  name: string
  archetype: string
}

export interface CreatedZones {
  data: Resource[]
  errors: any[]
}

//
// Lights
//
export interface Lights {
  errors: any[]
  data: Light[]
}

export interface Light {
  id: string
  id_v1: string
  owner: Resource
  type: 'light'
}

//
// Resources
//
export interface Resource {
  rid: string
  rtype: string
}
