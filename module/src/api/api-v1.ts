import { HttpClient } from '../http/httpclient'
import https from 'https'
import fs from 'fs'
import { Logger } from '../log/logger'

export class ApiV1 {
  #bridgeIp
  #appKey

  #httpsClient = new HttpClient(
    new https.Agent({
      ca: fs.readFileSync('./src/res/signify-root.crt'), // Signify root CA, to verify the bridge certificate and avoid 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' errors
      checkServerIdentity: () => undefined, // Disable hostname verification to avoid 'ERR_TLS_CERT_ALTNAME_INVALID' errors (since we use the bridge IP address)
    }),
  )

  constructor(bridgeIp: string, appKey?: string) {
    this.#bridgeIp = bridgeIp
    this.#appKey = appKey
  }

  #getBaseUrl = () => `https://${this.#bridgeIp}/api`

  async createUser(
    params: CreateUserParams,
  ): Promise<CreateUserError | CreateUserSuccess> {
    Logger.info(`[API v1] Creating user ...`)
    const uri = this.#getBaseUrl()
    return await this.#httpsClient.post<CreateUserError | CreateUserSuccess>(
      uri,
      params,
    )
  }

  async searchLights(params: SearchLightParams) {
    Logger.info(`[API v1] Searching for lights to add to bridge ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/lights`
    return await this.#httpsClient.post(uri, params)
  }

  async getNewLights() {
    Logger.info(`[API v1] Trying to retrieve new lights ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/lights/new`
    return await this.#httpsClient.get<NewLights>(uri)
  }

  async getLights() {
    Logger.info(`[API v1] Retrieving lights ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/lights`
    return await this.#httpsClient.get<LightsV1>(uri)
  }

  async deleteLight(id: string) {
    Logger.info(`[API v1] Deleting light '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/lights/${id}`
    return await this.#httpsClient.delete(uri)
  }
}

//
// User
//
export interface CreateUserParams {
  devicetype: string
  generateclientkey: boolean
}

export interface UserError {
  error: {
    type: number
    address: string
    description: string
  }
}
export type CreateUserError = UserError[]

export interface UserSuccess {
  success: {
    username: string
    clientkey: string
  }
}
export type CreateUserSuccess = UserSuccess[]

//
// Lights
//
export interface SearchLightParams {
  deviceid: string[]
}

export interface NewLights {
  lastscan: string
}

export type LightId = string
export interface LightV1 {
  uniqueid: string
}
export interface LightsV1 {
  [key: string]: LightV1
}
