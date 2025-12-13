import { LightColorType } from '../config/config'

export type MotionSensor = {
  name: string
  idV2: string
  lightIdV2: string
  motionIdV2: string
  lightIdV1: string
  presenceIdV1: string
  temperatureIdV1: string
}

export type Group = { idV1: string; idV2: string; groupType: string }

export type GroupScenes = {
  daySceneIdV2: string
  nightSceneIdV2: string
  eveningSceneIdV2: string
}

type Identifiers = {
  mac: string
  name: string
}

export type LightIdentifiers = Identifiers & {
  serial?: string
}

export type LightInfo = LightIdentifiers & {
  id_v1?: string
  id_v2?: string
  ownerId?: string
  colorType?: LightColorType
}

export enum AccessoryType {
  WallSwitch = 'Wall switch',
  TapDialSwitch = 'Tap dial switch',
  DimmerSwitch = 'Dimmer switch',
  SmartButton = 'Smart button',
  MotionSensor = 'Motion sensor',
}

export type AccessoryIdentifiers = Identifiers & {
  type: AccessoryType
  id_v1?: string
  id_v2?: string
}

export type TapDialSwitchIdentifiers = Identifiers & {
  type: AccessoryType
  dial_id_v1?: string
  switch_id_v1?: string
  id_v2?: string
}

export type MotionSensorIdentifiers = Identifiers & {
  type: AccessoryType
  presence_id_v1?: string
  light_id_v1?: string
  temperature_id_v1?: string
  id_v2?: string
  motion_id_v2?: string
  light_id_v2?: string
  temperature_id_v2?: string
}

export enum ButtonType {
  Button1 = 1,
  Button2 = 2,
  Button3 = 3,
  Button4 = 4,
}
