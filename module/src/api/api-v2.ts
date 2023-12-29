import { HttpClient } from '../http/httpclient'
import https from 'https'
import fs from 'fs'
import { Logger } from '../log/logger'

export class ApiV2 {
  #bridgeIp
  #key
  #httpsClient

  constructor(bridgeIp: string, key: string) {
    this.#bridgeIp = bridgeIp
    this.#key = key
    this.#httpsClient = new HttpClient(
      new https.Agent({
        ca: fs.readFileSync('./src/res/signify-root.crt'), // Signify root CA, to verify the bridge certificate and avoid 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' errors
        checkServerIdentity: () => undefined, // Disable hostname verification to avoid 'ERR_TLS_CERT_ALTNAME_INVALID' errors (since we use the bridge IP address)
      }),
      {
        'hue-application-key': this.#key,
      },
    )
  }

  #getBaseUrl = () => `https://${this.#bridgeIp}/clip/v2/resource`

  async createRoom(room: NewRoom): Promise<CreatedRoom> {
    Logger.info(
      `Creating room '${room.metadata.name}' on bridge ${this.#bridgeIp} ...`,
    )
    const uri = this.#getBaseUrl() + '/room'
    return await this.#httpsClient.post<CreatedRoom>(uri, room)
  }
}

export interface NewRoom {
  metadata: Metadata
  type: 'room'
  children: Child[]
}

export interface Room {
  id: string
  id_v1: string
  children: Child[]
  services: Child[]
  metadata: Metadata
  type: 'room'
}

export interface Child {
  rid: string
  rtype: string
}

export interface Metadata {
  name: string
  archetype: string
}

export interface CreatedRoom {
  data: Datum[]
  errors: any[]
}

export interface Datum {
  rid: string
  rtype: string
}
