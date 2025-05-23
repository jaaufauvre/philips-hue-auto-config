import { HttpClient } from '../http/httpclient'
import https from 'https'
import fs from 'fs'
import { Logger } from '../log/logger'

export class ApiV1 {
  readonly #bridgeIp
  readonly #appKey

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

  async searchSensors() {
    Logger.info(`[API v1] Searching for sensors to add to bridge ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/sensors`
    return await this.#httpsClient.post(uri, undefined)
  }

  async getNewSensors() {
    Logger.info(`[API v1] Trying to retrieve new sensors ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/sensors/new`
    return await this.#httpsClient.get<NewSensors>(uri)
  }

  async createSensor(sensor: NewSensor): Promise<CreatedSensor[]> {
    Logger.info(`[API v1] Creating sensor ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/sensors`
    return await this.#httpsClient.post<CreatedSensor[]>(uri, sensor)
  }

  async getSensors() {
    Logger.info(`[API v1] Retrieving sensors ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/sensors`
    return await this.#httpsClient.get<SensorsV1>(uri)
  }

  async deleteSensor(id: string) {
    Logger.info(`[API v1] Deleting sensor '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/sensors/${id}`
    return await this.#httpsClient.delete(uri)
  }

  async updateSensor(id: string, sensor: UpdatedSensor) {
    Logger.info(`[API v1] Updating sensor '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/sensors/${id}`
    return await this.#httpsClient.put(uri, sensor)
  }

  async updateDaylightSensorConfig(id: string, config: DaylightSensorConfig) {
    Logger.info(`[API v1] Updating daylight sensor '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/sensors/${id}/config`
    return await this.#httpsClient.put(uri, config)
  }

  async getRules() {
    Logger.info(`[API v1] Retrieving rules ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/rules`
    return await this.#httpsClient.get<RulesV1>(uri)
  }

  async createRule(rule: NewRule): Promise<CreatedRule[]> {
    Logger.info(`[API v1] Creating rule ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/rules`
    return await this.#httpsClient.post<CreatedRule[]>(uri, rule)
  }

  async updateRule(id: string, rule: RuleV1): Promise<UpdatedRule[]> {
    Logger.info(`[API v1] Updating rule ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/rules/${id}`
    return await this.#httpsClient.put<UpdatedRule[]>(uri, rule)
  }

  async deleteRule(id: string) {
    Logger.info(`[API v1] Deleting rule '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/rules/${id}`
    return await this.#httpsClient.delete(uri)
  }

  async getResourcelinks() {
    Logger.info(`[API v1] Retrieving resource links ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/resourcelinks`
    return await this.#httpsClient.get<ResourcelinksV1>(uri)
  }

  async deleteResourcelink(id: string) {
    Logger.info(`[API v1] Deleting resource link '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/resourcelinks/${id}`
    return await this.#httpsClient.delete(uri)
  }

  async getScenes() {
    Logger.info(`[API v1] Retrieving scenes ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/scenes`
    return await this.#httpsClient.get<ScenesV1>(uri)
  }

  async deleteScene(id: string) {
    Logger.info(`[API v1] Deleting scene '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/scenes/${id}`
    return await this.#httpsClient.delete(uri)
  }

  async getGroups() {
    Logger.info(`[API v1] Retrieving groups ...`)
    const uri = `${this.#getBaseUrl()}/${this.#appKey}/groups`
    return await this.#httpsClient.get<GroupsV1>(uri)
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
  [key: LightId]: LightV1
}

//
// Sensors
//
export interface NewSensors {
  lastscan: string
}

export type SensorId = string
export interface SensorV1 {
  type: string
  uniqueid?: string
  modelid?: string
}
export interface SensorsV1 {
  [key: SensorId]: SensorV1
}

export interface DaylightSensorConfig {
  long: string
  lat: string
  sunriseoffset: number
  sunsetoffset: number
}

export interface NewSensor {
  state: {
    flag: boolean
  }
  config: {
    on: boolean
    reachable: boolean
  }
  name: string
  type: string
  modelid: string
  manufacturername: string
  swversion: string
  uniqueid: string
  recycle: boolean
}

export interface CreatedSensor {
  success: {
    id: string
  }
}

export interface UpdatedSensor {
  name: string
}

//
// Rules
//
export type RuleId = string
export interface RuleV1 {
  name: string
  conditions: Condition[]
  actions: Action[]
  owner?: string
  recycle?: boolean
  created?: string
  lasttriggered?: string
  timestriggered?: number
}
export interface RulesV1 {
  [key: RuleId]: RuleV1
}

export interface NewRule {
  name: string
  conditions: Condition[]
  actions: Action[]
}

export interface CreatedRule {
  error: any
}

export interface UpdatedRule {
  error: any
}

export interface Action {
  address: string
  method: string
  body: Body
}

export interface Body {
  scene?: string
  on?: boolean
  transitiontime?: number
  bri_inc?: number
  status?: number
  flag?: boolean
}

export interface Condition {
  address: string
  operator: string
  value?: string | number
}

//
// Resourcelinks
//
export type ResourcelinkId = string
export interface ResourcelinkV1 {
  name: string
}
export interface ResourcelinksV1 {
  [key: ResourcelinkId]: ResourcelinkV1
}

//
// Scenes
//
export type SceneId = string
export interface SceneV1 {
  name: string
}
export interface ScenesV1 {
  [key: SceneId]: SceneV1
}

//
// Groups
//
export type GroupId = string
export interface GroupV1 {
  name: string
  lights: LightId[]
}
export interface GroupsV1 {
  [key: GroupId]: GroupV1
}
