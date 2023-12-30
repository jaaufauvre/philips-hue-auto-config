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

  #getBaseUrl = () => 'https://' + this.#bridgeIp

  async createUser(
    params: CreateUserParams,
  ): Promise<CreateUserError | CreateUserSuccess> {
    Logger.info(`Creating user on bridge ${this.#bridgeIp} ...`)
    const uri = this.#getBaseUrl() + '/api'
    return await this.#httpsClient.post<CreateUserError | CreateUserSuccess>(
      uri,
      params,
    )
  }
}

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
