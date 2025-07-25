import { HttpClient } from '../http/httpclient'
import https from 'https'
import fs from 'fs'
import { Logger } from '../log/logger'

export class ApiV2 {
  readonly #bridgeIp
  readonly #httpsClient

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

  async deleteRoom(id: string) {
    Logger.info(`[API v2] Deleting room '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/room/${id}`
    return await this.#httpsClient.delete(uri)
  }

  async updateRoom(id: string, room: UpdatedRoom) {
    Logger.info(`[API v2] Updating room '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/room/${id}`
    return await this.#httpsClient.put(uri, room)
  }

  async createZone(zone: NewZone): Promise<CreatedZones> {
    Logger.info(`[API v2] Creating zone '${zone.metadata.name}' ...`)
    const uri = `${this.#getBaseUrl()}/zone`
    return await this.#httpsClient.post<CreatedZones>(uri, zone)
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

  async deleteZone(id: string) {
    Logger.info(`[API v2] Deleting zone '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/zone/${id}`
    return await this.#httpsClient.delete(uri)
  }

  async updateZone(id: string, zone: UpdatedZone) {
    Logger.info(`[API v2] Updating zone '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/zone/${id}`
    return await this.#httpsClient.put(uri, zone)
  }

  async getLights(): Promise<Lights> {
    Logger.info(`[API v2] Retrieving lights ...`)
    const uri = `${this.#getBaseUrl()}/light`
    return await this.#httpsClient.get<Lights>(uri)
  }

  async updateLight(id: string, light: UpdatedLight): Promise<UpdatedLight> {
    Logger.info(`[API v2] Updating light '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/light/${id}`
    return await this.#httpsClient.put<UpdatedLight>(uri, light)
  }

  async getDevices(): Promise<Devices> {
    Logger.info(`[API v2] Retrieving devices ...`)
    const uri = `${this.#getBaseUrl()}/device`
    return await this.#httpsClient.get<Devices>(uri)
  }

  async getDevice(id: string): Promise<Devices> {
    Logger.info(`[API v2] Retrieving device ...`)
    const uri = `${this.#getBaseUrl()}/device/${id}`
    return await this.#httpsClient.get<Devices>(uri)
  }

  async updateDevice(
    id: string,
    device: UpdatedDevice,
  ): Promise<UpdatedDevice> {
    Logger.info(`[API v2] Updating device '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/device/${id}`
    return await this.#httpsClient.put<UpdatedDevice>(uri, device)
  }

  async deleteDevice(id: string) {
    Logger.info(`[API v2] Deleting device '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/device/${id}`
    return await this.#httpsClient.delete(uri)
  }

  async createScene(scene: NewScene) {
    Logger.info(
      `[API v2] Creating scene '${scene.metadata.name}' for group '${scene.group.rid}' ...`,
    )
    const uri = `${this.#getBaseUrl()}/scene`
    return await this.#httpsClient.post<CreatedScenes>(uri, scene)
  }

  async getScene(id: string): Promise<Scenes> {
    Logger.info(`[API v2] Retrieving scene '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/scene/${id}`
    return await this.#httpsClient.get<Scenes>(uri)
  }

  async updateScene(id: string, scene: UpdatedScene) {
    Logger.info(`[API v2] Updating scene '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/scene/${id}`
    return await this.#httpsClient.put(uri, scene)
  }

  async getBehaviorInstances(): Promise<BehaviorInstances> {
    Logger.info(`[API v2] Retrieving behavior instances ...`)
    const uri = `${this.#getBaseUrl()}/behavior_instance`
    return await this.#httpsClient.get<BehaviorInstances>(uri)
  }

  async createBehaviorInstance(behavior: NewBehaviorInstance) {
    Logger.info(`[API v2] Creating behavior instance ...`)
    const uri = `${this.#getBaseUrl()}/behavior_instance`
    return await this.#httpsClient.post(uri, behavior)
  }

  async deleteBehaviorInstance(id: string) {
    Logger.info(`[API v2] Deleting behavior instance '${id}' ...`)
    const uri = `${this.#getBaseUrl()}/behavior_instance/${id}`
    return await this.#httpsClient.delete(uri)
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
  color?: any
  color_temperature?: any
  gradient?: any
}

export interface UpdatedLight {
  errors?: any[]
  metadata?: DeviceMetadata
  powerup?: Powerup
}

export interface Powerup {
  preset: string
}

//
// Devices
//
export interface Devices {
  errors: any[]
  data: Device[]
}

export interface Device {
  id: string
  id_v1: string
  type: 'device'
  services: Resource[]
  metadata: DeviceMetadata
  product_data: DeviceProductData
  device_mode?: DeviceMode
}

export interface UpdatedDevice {
  errors?: any[]
  metadata: DeviceMetadata
  device_mode?: DeviceMode
}

export interface DeviceMetadata {
  name: string
  archetype?: string
}

export interface DeviceProductData {
  product_name: string
  model_id: string
}

export interface DeviceMode {
  mode: string
  status?: string
}

//
// Resources
//
export interface Resource {
  rid: string
  rtype: string
}

//
// Scenes
//
export interface NewScene {
  actions: SceneAction[]
  metadata: SceneMetadata
  group: Resource
  type: 'scene'
  auto_dynamic?: boolean
  speed?: number
}

export interface Scenes {
  errors: any[]
  data: Scene[]
}

export interface Scene {
  id: string
  id_v1: string
  type: 'scene'
}

export interface UpdatedScene {
  recall: Recall
}

export interface CreatedScenes {
  data: Resource[]
  errors: any[]
}

export interface SceneAction {
  target: Resource
  action: {
    on: On
    dimming?: Dimming
    color_temperature?: ColorTemperature
    color?: Color
    effects?: Effects
    effects_v2?: EffectsV2
    gradient?: Gradient
  }
}

interface Gradient {
  points: { color: Color }[]
  mode?: string
}

interface Effects {
  effect: string
}

interface EffectsV2 {
  action: {
    effect: string
    parameters: {
      color?: Color
      color_temperature?: ColorTemperature
      speed?: number
    }
  }
}

export interface ColorTemperature {
  mirek: number
}

export interface Color {
  xy: {
    x: number
    y: number
  }
}

export interface Dimming {
  brightness: number
}

export interface On {
  on: boolean
}

export interface SceneMetadata {
  name: string
  image?: Resource
}

export interface Recall {
  action: string
}

//
// Behaviors
//
export interface BehaviorInstances {
  data: BehaviorInstance[]
  errors: any[]
}

export interface BehaviorInstance {
  id: string
  type: 'behavior_instance'
}

export interface NewBehaviorInstance {
  type: string
  enabled: boolean
  script_id: string
  configuration:
    | TapDialBehaviorConfiguration
    | GenericButtonBehaviorConfiguration
}

export interface TapDialBehaviorConfiguration {
  device: Resource
  button1: ButtonBehaviorConfiguration
  button2: ButtonBehaviorConfiguration
  button3: ButtonBehaviorConfiguration
  button4: ButtonBehaviorConfiguration
  rotary: RotaryBehaviorConfiguration
}

export interface GenericButtonBehaviorConfiguration {
  device: Resource
  buttons: ButtonsBehaviorConfiguration
  model_id: string
}

export interface ButtonBehaviorConfiguration {
  on_short_release: {
    action: string
  }
  on_long_press: {
    action: string
  }
  where: Where[]
}

export interface ButtonsBehaviorConfiguration {
  [buttonServiceId: string]: {
    on_repeat: {
      action: string
    }
    on_short_release: {
      recall_single_extended: {
        actions: {
          action: string
        }[]
        with_off: {
          enabled: boolean
        }
      }
    }
    where: Where[]
  }
}

export interface Where {
  group: Resource
}

export interface RotaryBehaviorConfiguration {
  on_dim_off: {
    action: string
  }
  on_dim_on: {
    recall_single: RecallSingle[]
  }
  where: Where[]
}

export interface RecallSingle {
  action: {
    recall: Resource
  }
}
