import {
  Config,
  ExtendedDimmerSwitch,
  ExtendedLight,
  ExtendedMotionSensor,
  ExtendedRoom,
  ExtendedSmartButton,
  ExtendedTapDialSwitch,
  ExtendedWallSwitch,
  ExtendedZone,
  LightColorType,
} from './config/config'
import { Color, Logger } from './log/logger'
import { AccessoryType, Bridge, ButtonType } from './bridge/bridge'
import {
  AccessoryConfig,
  Action,
  GradientMode,
  LightAction,
  Scene,
} from './config/config-gen'
import _ from 'lodash'

const bridge = new Bridge()
let config: Config

main().catch((e) => {
  if (e instanceof Error) {
    Logger.error(e.message)
  } else Logger.error(e)
  throw e
})

async function main() {
  Logger.setDebug(false)
  Logger.info(Color.Yellow, '🤖 Starting ...')

  // Inputs
  const providedBridgeIp = process.env.npm_config_bridge as string
  const providedAppKey = process.env.npm_config_appkey as string
  const configPath = process.env.npm_config_config as string
  const deleteDevices = process.env.npm_config_delete_devices as string
  const configEncryptionKey = process.env.npm_config_xor as string

  // Configuration
  config = new Config(configPath, configEncryptionKey)
  config.print()

  // Discovery?
  let bridgeIpAddresses
  if (!providedBridgeIp) {
    bridgeIpAddresses = await Bridge.discoverBridges()
    Logger.info(
      `Found ${bridgeIpAddresses.length} bridge(s): ${bridgeIpAddresses}`,
    )
  } else {
    Logger.info(`Provided bridge address: ${providedBridgeIp}`)
    bridgeIpAddresses = [providedBridgeIp]
  }

  // User/app key creation?
  if (providedAppKey && providedBridgeIp) {
    Logger.info(
      `Provided app key for bridge ${providedBridgeIp}: '${providedAppKey}'`,
    )
    bridge.init(providedBridgeIp, providedAppKey)
  } else {
    const result = await Bridge.findAndAccessBridge(bridgeIpAddresses)
    Logger.info(`Created app key for bridge ${result[0]}: '${result[1]}'`)
    bridge.init(result[0], result[1])
  }

  // Reset
  if (deleteDevices) {
    Logger.info('Deleting bridge resources and devices')
    await bridge.resetBridgeWithDevices()
  } else {
    Logger.info('Deleting bridge resources')
    await bridge.resetBridge()
  }
  Logger.info(Color.Green, `All bridge resources were deleted`)

  // Update bridge name & location
  const lat = config.bridge.lat
  const long = config.bridge.long
  const name = config.bridge.name
  await bridge.updateBridgeName(name)
  Logger.info(Color.Green, `Bridge name is: ${name}`)
  await bridge.updateBridgeLocation(lat, long)
  Logger.info(Color.Green, `Bridge location is: ${lat}, ${long}`)

  // Create zones & rooms
  for (const room of config.rooms) {
    const roomIds = await bridge.addRoom(room.name, room.type)
    room.idV1 = roomIds[0]
    room.idV2 = roomIds[1]
    Logger.info(
      Color.Green,
      `Room '${room.name}' was added with IDs: '${room.idV1}' (v1) and '${room.idV2}' (v2)`,
    )
  }
  for (const zone of config.zones) {
    const zoneIds = await bridge.addZone(zone.name, zone.type)
    zone.idV1 = zoneIds[0]
    zone.idV2 = zoneIds[1]
    Logger.info(
      Color.Green,
      `Zone '${zone.name}' was added with IDs: '${zone.idV1}' (v1) and '${zone.idV2}' (v2)`,
    )
  }

  // Add lights
  const lightIds = config.lights.map((light) => ({
    mac: light.mac,
    serial: light.serial,
    name: light.name,
  }))
  _.forEach(await bridge.addLights(lightIds), (lightId) => {
    const light = config.getResourceById(lightId.mac)! as ExtendedLight
    light.idV1 = lightId.id_v1
    light.idV2 = lightId.id_v2
    light.ownerId = lightId.ownerId
    light.colorType = lightId.colorType
  })

  for (const light of config.lights) {
    // Update light types & names
    await bridge.updateLightMetadata(light.ownerId!, light.name, light.type)
    Logger.info(Color.Green, `Metadata for light '${light.name}' was updated'`)

    // Add lights to rooms & zones
    const room = config.getResourceById(light.room) as ExtendedRoom
    await bridge.addLightToRoom(light.ownerId!, room!.idV2!)
    Logger.info(
      Color.Green,
      `Light '${light.name}' was added to room '${room.name}'`,
    )
    for (const zoneId of light.zones ?? []) {
      const zone = config.getResourceById(zoneId) as ExtendedZone
      await bridge.addLightToZone(light.idV2!, zone.idV2!)
      Logger.info(
        Color.Green,
        `Light '${light.name}' was added to zone '${zone.name}'`,
      )
    }
  }

  // Create scenes in rooms and zones
  const allGroupIds = _.concat<ExtendedRoom | ExtendedZone>(
    config.rooms,
    config.zones,
  ).map((group) => group.id)
  for (const scene of config.scenes) {
    for (const groupId of scene.groups ?? allGroupIds) {
      const group = config.getResourceById(groupId) as
        | ExtendedRoom
        | ExtendedZone
      await addScene(group, scene)
    }
  }

  // Activate default scene in rooms
  for (const group of config.rooms) {
    await bridge.activateScene(
      group.sceneIdsV2!.get(config.defaults.scenes.day)!,
    )
  }

  // Set lights behavior at power on
  for (const light of config.lights) {
    const lightId = light.idV2!
    await bridge.updateLightPowerUp(lightId, config.defaults.powerupBehavior)
  }
  Logger.info(Color.Green, `Updated power up behavior for all lights`)

  // Add wall switches, dimmer switches and smart buttons
  const wallSwitchIds = config.wallSwitches.map((wallSwitch) => ({
    mac: wallSwitch.mac,
    name: wallSwitch.name,
    type: AccessoryType.WallSwitch,
  }))
  const dimmerSwitchIds = config.dimmerSwitches.map((dimmerSwitch) => ({
    mac: dimmerSwitch.mac,
    name: dimmerSwitch.name,
    type: AccessoryType.DimmerSwitch,
  }))
  const smartButtonIds = config.smartButtons.map((smartButton) => ({
    mac: smartButton.mac,
    name: smartButton.name,
    type: AccessoryType.SmartButton,
  }))
  _.forEach(
    await bridge.addAccessories(
      _.concat(dimmerSwitchIds, wallSwitchIds, smartButtonIds),
    ),
    (accessoryId) => {
      const accessory = config.getResourceById(accessoryId.mac)! as
        | ExtendedWallSwitch
        | ExtendedDimmerSwitch
        | ExtendedSmartButton
      accessory.idV1 = accessoryId.id_v1
      accessory.idV2 = accessoryId.id_v2
      Logger.info(
        Color.Green,
        `${accessoryId.type} '${accessory.name}' was added with IDs: '${accessory.idV1}' (v1) and '${accessory.idV2}' (v2)`,
      )
    },
  )

  // Add tap dial switches
  const tapDialSwitchIds = config.tapDialSwitches.map((tapDialSwitch) => ({
    type: AccessoryType.TapDialSwitch,
    mac: tapDialSwitch.mac,
    name: tapDialSwitch.name,
  }))
  _.forEach(
    await bridge.addTapDialSwitches(tapDialSwitchIds),
    (tapDialSwitchId) => {
      const tapDialSwitch = config.getResourceById(
        tapDialSwitchId.mac,
      )! as ExtendedTapDialSwitch
      tapDialSwitch.dialIdV1 = tapDialSwitchId.dial_id_v1
      tapDialSwitch.switchIdV1 = tapDialSwitchId.switch_id_v1
      tapDialSwitch.idV2 = tapDialSwitchId.id_v2
      Logger.info(
        Color.Green,
        `Tap dial switch '${tapDialSwitch.name}' was added with IDs: '${tapDialSwitch.dialIdV1}', '${tapDialSwitch.switchIdV1}' (v1) and '${tapDialSwitch.idV2}' (v2)`,
      )
    },
  )

  // Add motion sensors
  const motionSensorIds = config.motionSensors.map((motionSensor) => ({
    type: AccessoryType.MotionSensor,
    mac: motionSensor.mac,
    name: motionSensor.name,
  }))
  _.forEach(
    await bridge.addMotionSensors(motionSensorIds),
    (motionSensorId) => {
      const motionSensor = config.getResourceById(
        motionSensorId.mac,
      )! as ExtendedMotionSensor
      motionSensor.presenceIdV1 = motionSensorId.presence_id_v1
      motionSensor.lightIdV1 = motionSensorId.light_id_v1
      motionSensor.temperatureIdV1 = motionSensorId.temperature_id_v1
      motionSensor.idV2 = motionSensorId.id_v2
      Logger.info(
        Color.Green,
        `Motion sensor '${motionSensor.name}' was added with IDs: '${motionSensor.presenceIdV1}', '${motionSensor.lightIdV1}', '${motionSensor.temperatureIdV1}' (v1) and '${motionSensor.idV2}' (v2)`,
      )
    },
  )

  // Configure wall switches
  for (const wallSwitch of config.wallSwitches) {
    // Create button rules
    await addAccessoryButton(
      AccessoryType.WallSwitch,
      ButtonType.Button1,
      wallSwitch.button1,
      wallSwitch.idV1!,
      wallSwitch.name,
    )
    await addAccessoryButton(
      AccessoryType.WallSwitch,
      ButtonType.Button2,
      wallSwitch.button2,
      wallSwitch.idV1!,
      wallSwitch.name,
    )

    // Update wall switch name and mode
    await bridge.updateWallSwitchProperties(
      wallSwitch.idV2!,
      wallSwitch.name,
      wallSwitch.mode,
    )
    Logger.info(Color.Green, `Wall switch '${wallSwitch.name}' was configured`)
  }

  // Configure smart buttons
  for (const smartButton of config.smartButtons) {
    // Create button rules
    await addAccessoryButton(
      AccessoryType.SmartButton,
      ButtonType.Button1,
      smartButton.button,
      smartButton.idV1!,
      smartButton.name,
    )

    // Create behavior script (dim +/-)
    for (const groupId of smartButton.button.groups) {
      const group = config.getResourceById(groupId)! as
        | ExtendedRoom
        | ExtendedZone
      await bridge.configureSmartButton(
        smartButton.idV2!,
        group.idV2!,
        group.groupType!,
      )
    }

    // Update smart button name
    await bridge.updateSmartButtonProperties(
      smartButton.idV2!,
      smartButton.name,
    )
    Logger.info(
      Color.Green,
      `Smart button '${smartButton.name}' was configured`,
    )
  }

  // Configure dimmer switches
  for (const dimmerSwitch of config.dimmerSwitches) {
    // Create button rules
    await addAccessoryButton(
      AccessoryType.DimmerSwitch,
      ButtonType.Button1,
      dimmerSwitch.button1,
      dimmerSwitch.idV1!,
      dimmerSwitch.name,
    )
    await addAccessoryButton(
      AccessoryType.DimmerSwitch,
      ButtonType.Button2,
      dimmerSwitch.button2,
      dimmerSwitch.idV1!,
      dimmerSwitch.name,
    )
    await addAccessoryButton(
      AccessoryType.DimmerSwitch,
      ButtonType.Button3,
      dimmerSwitch.button3,
      dimmerSwitch.idV1!,
      dimmerSwitch.name,
    )
    await addAccessoryButton(
      AccessoryType.DimmerSwitch,
      ButtonType.Button4,
      dimmerSwitch.button4,
      dimmerSwitch.idV1!,
      dimmerSwitch.name,
    )

    // Update dimmer switch name
    await bridge.updateDimmerSwitchProperties(
      dimmerSwitch.idV2!,
      dimmerSwitch.name,
    )
    Logger.info(
      Color.Green,
      `Dimmer switch '${dimmerSwitch.name}' was configured`,
    )
  }

  // Configure tap dial switches
  for (const tapDialSwitch of config.tapDialSwitches) {
    // Create button rules
    await addAccessoryButton(
      AccessoryType.TapDialSwitch,
      ButtonType.Button1,
      tapDialSwitch.button1,
      tapDialSwitch.switchIdV1!,
      tapDialSwitch.name,
    )
    await addAccessoryButton(
      AccessoryType.TapDialSwitch,
      ButtonType.Button2,
      tapDialSwitch.button2,
      tapDialSwitch.switchIdV1!,
      tapDialSwitch.name,
    )
    await addAccessoryButton(
      AccessoryType.TapDialSwitch,
      ButtonType.Button3,
      tapDialSwitch.button3,
      tapDialSwitch.switchIdV1!,
      tapDialSwitch.name,
    )
    await addAccessoryButton(
      AccessoryType.TapDialSwitch,
      ButtonType.Button4,
      tapDialSwitch.button4,
      tapDialSwitch.switchIdV1!,
      tapDialSwitch.name,
    )

    // Create behavior script (dim +/-)
    for (const groupId of tapDialSwitch.dial.groups) {
      const group = config.getResourceById(groupId)! as
        | ExtendedRoom
        | ExtendedZone
      await bridge.configureTapDial(
        tapDialSwitch.idV2!,
        group.idV2!,
        group.sceneIdsV2!.get(config.getDaySceneId(tapDialSwitch.dial))!,
        group.groupType!,
      )
    }

    // Update tap dial switch name
    await bridge.updateTapDialSwitchProperties(
      tapDialSwitch.switchIdV1!,
      tapDialSwitch.dialIdV1!,
      tapDialSwitch.idV2!,
      tapDialSwitch.name,
    )
    Logger.info(
      Color.Green,
      `Tap dial switch '${tapDialSwitch.name}' was configured`,
    )
  }

  // Configure motion sensors
  for (const motionSensor of config.motionSensors) {
    for (const groupId of motionSensor.motion.groups) {
      const group = config.getResourceById(groupId)! as
        | ExtendedRoom
        | ExtendedZone

      // Create motion sensor rules
      await bridge.configureMotionSensor(
        motionSensor.mac,
        motionSensor.lightIdV1!,
        motionSensor.presenceIdV1!,
        motionSensor.name,
        group.idV1!,
        group.sceneIdsV1!.get(config.getDaySceneId(motionSensor.motion))!,
        group.sceneIdsV1!.get(config.getNightSceneId(motionSensor.motion))!,
        group.sceneIdsV1!.get(config.getEveningSceneId(motionSensor.motion))!,
      )
    }

    // Update motion sensor name & default settings
    await bridge.updateMotionSensorProperties(
      motionSensor.temperatureIdV1!,
      motionSensor.lightIdV1!,
      motionSensor.presenceIdV1!,
      motionSensor.idV2!,
      motionSensor.name,
    )
    Logger.info(
      Color.Green,
      `Motion sensor '${motionSensor.name}' was configured`,
    )
  }

  // Delete unassigned lights and added accessories that were not in the config
  await bridge.deleteUnexpectedLights(config.getAllResourceMacs())
  await bridge.deleteUnexpectedAccessories(config.getAllResourceMacs())

  Logger.info(Color.Yellow, 'All done! 🙌')
}

async function addAccessoryButton(
  accessoryType: AccessoryType,
  button: ButtonType,
  buttonConfig: AccessoryConfig | undefined,
  accessoryIdV1: string,
  accessoryName: string,
) {
  if (!buttonConfig) {
    return
  }

  for (const groupId of buttonConfig.groups) {
    const group = config.getResourceById(groupId)! as
      | ExtendedRoom
      | ExtendedZone

    await bridge.configureAccessoryButton(
      accessoryType,
      button,
      accessoryIdV1,
      accessoryName,
      group.idV1!,
      group.sceneIdsV1!.get(config.getDaySceneId(buttonConfig))!,
      group.sceneIdsV1!.get(config.getNightSceneId(buttonConfig))!,
      group.sceneIdsV1!.get(config.getEveningSceneId(buttonConfig))!,
    )
  }
}

async function addScene(group: ExtendedRoom | ExtendedZone, scene: Scene) {
  const groupLights = config.getGroupLights(group)
  const lightActions = new Map<string, LightAction | undefined>()
  const actions = {
    colorActions: scene.colorAmbianceActions,
    colorActionCount: scene.colorAmbianceActions?.length ?? 0,
    currentColorAction: 0,
    nextColorAction: () => {
      actions.currentColorAction =
        (actions.currentColorAction + 1) % actions.colorActionCount
      return scene.colorAmbianceActions![actions.currentColorAction]
    },
    colorAction: (index: number) => {
      return scene.colorAmbianceActions![index]
    },
    whiteAmbianceAction: () => scene.whiteAmbianceAction!,
    whiteAction: () => scene.whiteAction!,
  }

  _.forEach(groupLights, (light) => {
    lightActions.set(light.idV2!, undefined) // Default: light is off
    if (useExplicitAction(light, scene)) {
      lightActions.set(light.idV2!, getLightAction(light, scene.actions!))
    }
    if (useAutoAction(light, scene)) {
      lightActions.set(light.idV2!, generateLightAction(light, actions))
    }
  })
  await createScene(
    scene.id,
    scene.name,
    group,
    lightActions,
    scene.imageID,
    scene.autoDynamic,
    scene.speed,
  )
}

async function createScene(
  id: string,
  name: string,
  group: ExtendedRoom | ExtendedZone,
  lightActions: Map<string, LightAction | undefined>,
  imageId?: string,
  autoDynamic?: boolean,
  speed?: number,
) {
  const sceneIds = await bridge.addScene(
    name,
    group.idV2!,
    group.groupType!,
    lightActions,
    imageId,
    autoDynamic,
    speed,
  )
  const sceneIdV1 = sceneIds[0]
  const sceneIdV2 = sceneIds[1]
  group.sceneIdsV1!.set(id, sceneIdV1)
  group.sceneIdsV2!.set(id, sceneIdV2)
  Logger.info(
    Color.Green,
    `Scene '${name}' was created for ${group.groupType} '${group.name}' with IDs: '${sceneIdV1}' (v1) and '${sceneIdV2}' (v2)`,
  )
}

function useOffAction(light: ExtendedLight, scene: Scene): boolean {
  const action = _.find(scene.actions, { target: light.id })
  return action !== undefined && action.lightAction === undefined
}

function useExplicitAction(light: ExtendedLight, scene: Scene): boolean {
  const action = _.find(scene.actions, { target: light.id })
  return action?.lightAction !== undefined
}

function useAutoAction(light: ExtendedLight, scene: Scene): boolean {
  if (useOffAction(light, scene) || useExplicitAction(light, scene)) {
    return false
  }
  switch (light.colorType) {
    case LightColorType.Gradient:
    case LightColorType.Colored:
      return (
        scene.colorAmbianceActions != undefined &&
        scene.colorAmbianceActions.length > 0
      )
    case LightColorType.WarmToCoolWhite:
      return scene.whiteAmbianceAction != undefined
    case LightColorType.SoftWarmWhite:
      return scene.whiteAction != undefined
    default:
      return false
  }
}

function getLightAction(light: ExtendedLight, actions: Action[]): LightAction {
  return config.getResourceById(
    _.find(actions, { target: light.id })!.lightAction!,
  ) as LightAction
}

function generateLightAction(
  light: ExtendedLight,
  actions: any,
): LightAction | undefined {
  switch (light.colorType) {
    case LightColorType.Gradient:
      return generateGradientLightAction(actions)
    case LightColorType.Colored:
      return config.getResourceById(actions.nextColorAction()) as LightAction
    case LightColorType.WarmToCoolWhite:
      return config.getResourceById(
        actions.whiteAmbianceAction(),
      ) as LightAction
    case LightColorType.SoftWarmWhite:
      return config.getResourceById(actions.whiteAction()) as LightAction
    default:
      return undefined // Light off
  }
}

function generateGradientLightAction(actions: any): LightAction {
  const useGradient = _.every(actions.colorActions, (action) => {
    return (config.getResourceById(action) as LightAction).color != undefined
  })
  if (!useGradient) {
    return config.getResourceById(actions.nextColorAction()) as LightAction
  }
  const gradient = _.times(actions.colorActionCount, (i) => {
    const color = (
      config.getResourceById(actions.colorAction(i)) as LightAction
    ).color
    return { x: color!.x, y: color!.y }
  })
  const brightness = (
    config.getResourceById(actions.colorAction(0)) as LightAction
  ).brightness
  return {
    id: 'generated_gradient_action',
    gradient,
    gradientMode: GradientMode.InterpolatedPalette,
    brightness,
  }
}
