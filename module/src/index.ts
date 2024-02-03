import {
  Config,
  ExtendedLight,
  ExtendedRoom,
  ExtendedWallSwitch,
  ExtendedTapDialSwitch,
  ExtendedZone,
  ExtendedDimmerSwitch,
  ExtendedMotionSensor,
} from './config/config'
import { Logger, Color } from './log/logger'
import { AccessoryType, Bridge, ButtonType } from './bridge/bridge'
import _ from 'lodash'
import { Scene } from './config/config-gen'

main().catch((e) => {
  if (e instanceof Error) {
    Logger.error(e.message)
  } else Logger.error(e)
})

async function main() {
  Logger.setDebug(false)
  Logger.info(Color.Yellow, '🤖 Starting ...')

  // Inputs
  const providedBridgeIp = process.env.npm_config_bridge as string
  const providedAppKey = process.env.npm_config_appkey as string
  const configPath = process.env.npm_config_config as string
  const configEncryptionKey = process.env.npm_config_xor as string

  // Configuration
  const config = new Config(configPath, configEncryptionKey)
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
  const bridge = new Bridge()
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
  await bridge.resetBridge()
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
    Logger.info(
      Color.Green,
      `Light '${light.name}' was added with IDs: '${light.idV1}' (v1) and '${light.idV2}' (v2)`,
    )
  })

  for (const light of config.lights) {
    // Update light types & names
    await bridge.updateLightMetadata(light.ownerId!, light.name, light.type)
    Logger.info(Color.Green, `Metadata for light '${light.name}' were updated'`)

    // Add lights to rooms & zones
    const room = config.getResourceById(light.room)!
    await bridge.addLightToRoom(light.ownerId!, room!.idV2!)
    Logger.info(
      Color.Green,
      `Light '${light.name}' was added to room '${room.name}'`,
    )
    for (const zoneId of light.zones ?? []) {
      const zone = config.getResourceById(zoneId)!
      await bridge.addLightToZone(light.idV2!, zone.idV2!)
      Logger.info(
        Color.Green,
        `Light '${light.name}' was added to zone '${zone.name}'`,
      )
    }
  }

  // Create default scenes in rooms and zones
  const dayScene = config.defaults.scenes.day
  const nightScene = config.defaults.scenes.night
  for (const group of _.concat<ExtendedRoom | ExtendedZone>(
    config.rooms,
    config.zones,
  )) {
    await addScene(dayScene, group, config, bridge)
    await addScene(nightScene, group, config, bridge)
    await bridge.activateScene(group.sceneIdsV2!.get(dayScene)!)
  }

  // Set lights behavior at power on
  for (const light of config.lights) {
    const lightId = light.idV2!
    await bridge.updateLightPowerUp(
      lightId,
      config.defaults['powerup-behavior'],
    )
  }
  Logger.info(Color.Green, `Updated power up behavior for all lights`)

  // Add wall switches and dimmer switches
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
  _.forEach(
    await bridge.addAccessories(_.concat(dimmerSwitchIds, wallSwitchIds)),
    (accessoryId) => {
      const accessory = config.getResourceById(accessoryId.mac)! as
        | ExtendedWallSwitch
        | ExtendedDimmerSwitch
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
    await addWallSwitchButton(ButtonType.Button1, wallSwitch, config, bridge)
    await addWallSwitchButton(ButtonType.Button2, wallSwitch, config, bridge)

    // Update wall switch name and mode
    await bridge.updateWallSwitchProperties(
      wallSwitch.idV2!,
      wallSwitch.name,
      wallSwitch.mode,
    )
    Logger.info(Color.Green, `Wall switch '${wallSwitch.name}' was configured`)
  }

  // Configure dimmer switches
  for (const dimmerSwitch of config.dimmerSwitches) {
    // Create button rules
    await addDimmerSwitchButton(
      ButtonType.Button1,
      dimmerSwitch,
      config,
      bridge,
    )
    await addDimmerSwitchButton(
      ButtonType.Button2,
      dimmerSwitch,
      config,
      bridge,
    )
    await addDimmerSwitchButton(
      ButtonType.Button3,
      dimmerSwitch,
      config,
      bridge,
    )
    await addDimmerSwitchButton(
      ButtonType.Button4,
      dimmerSwitch,
      config,
      bridge,
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
    await addTapDialSwitchButton(
      ButtonType.Button1,
      tapDialSwitch,
      config,
      bridge,
    )
    await addTapDialSwitchButton(
      ButtonType.Button2,
      tapDialSwitch,
      config,
      bridge,
    )
    await addTapDialSwitchButton(
      ButtonType.Button3,
      tapDialSwitch,
      config,
      bridge,
    )
    await addTapDialSwitchButton(
      ButtonType.Button4,
      tapDialSwitch,
      config,
      bridge,
    )

    // Create behavior script
    const group = config.getResourceById(tapDialSwitch.dial.group)! as
      | ExtendedRoom
      | ExtendedZone
    await bridge.configureTapDial(
      tapDialSwitch.idV2!,
      group.idV2!,
      group.sceneIdsV2!.get(dayScene)!,
      group.groupType!,
    )

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
    const group = config.getResourceById(motionSensor.group)! as
      | ExtendedRoom
      | ExtendedZone

    // Create default scenes
    const dayScene = config.defaults.scenes['motion-sensor-day']!
    const nightScene = config.defaults.scenes['motion-sensor-night']!
    await addScene(dayScene, group, config, bridge)
    await addScene(nightScene, group, config, bridge)

    // Create motion sensor rules
    await bridge.configureMotionSensor(
      motionSensor.lightIdV1!,
      motionSensor.presenceIdV1!,
      motionSensor.name,
      group.idV1!,
      group.sceneIdsV1!.get(dayScene)!,
      group.sceneIdsV1!.get(nightScene)!,
    )

    // Update motion sensor name
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

  Logger.info(Color.Yellow, 'Done! 🙌')
}

async function addWallSwitchButton(
  button: ButtonType,
  wallSwitch: ExtendedWallSwitch,
  config: Config,
  bridge: Bridge,
) {
  const configButton =
    button === ButtonType.Button1 ? wallSwitch.button1 : wallSwitch.button2
  if (!configButton) {
    return
  }
  const group = config.getResourceById(configButton.group)! as
    | ExtendedRoom
    | ExtendedZone
  await bridge.configureAccessoryButton(
    AccessoryType.WallSwitch,
    button,
    wallSwitch.idV1!,
    wallSwitch.name,
    group.idV1!,
    group.sceneIdsV1!.get(config.defaults.scenes.day)!,
    group.sceneIdsV1!.get(config.defaults.scenes.night)!,
  )
}

async function addTapDialSwitchButton(
  button: ButtonType,
  tapDialSwitch: ExtendedTapDialSwitch,
  config: Config,
  bridge: Bridge,
) {
  let configButton
  switch (button) {
    case ButtonType.Button1:
      configButton = tapDialSwitch.button1
      break
    case ButtonType.Button2:
      configButton = tapDialSwitch.button2
      break
    case ButtonType.Button3:
      configButton = tapDialSwitch.button3
      break
    case ButtonType.Button4:
      configButton = tapDialSwitch.button4
      break
    default:
      throw new Error(`Unsupported button type: '${button}'`)
  }
  const group = config.getResourceById(configButton.group)! as
    | ExtendedRoom
    | ExtendedZone
  await bridge.configureAccessoryButton(
    AccessoryType.TapDialSwitch,
    button,
    tapDialSwitch.switchIdV1!,
    tapDialSwitch.name,
    group.idV1!,
    group.sceneIdsV1!.get(config.defaults.scenes.day)!,
    group.sceneIdsV1!.get(config.defaults.scenes.night)!,
  )
}

async function addDimmerSwitchButton(
  button: ButtonType,
  dimmerSwitch: ExtendedDimmerSwitch,
  config: Config,
  bridge: Bridge,
) {
  let configButton
  switch (button) {
    case ButtonType.Button1:
      configButton = dimmerSwitch.button1
      break
    case ButtonType.Button2:
      configButton = dimmerSwitch.button2
      break
    case ButtonType.Button3:
      configButton = dimmerSwitch.button3
      break
    case ButtonType.Button4:
      configButton = dimmerSwitch.button4
      break
    default:
      throw new Error(`Unsupported button type: '${button}'`)
  }
  const group = config.getResourceById(configButton.group)! as
    | ExtendedRoom
    | ExtendedZone
  await bridge.configureAccessoryButton(
    AccessoryType.DimmerSwitch,
    button,
    dimmerSwitch.idV1!,
    dimmerSwitch.name,
    group.idV1!,
    group.sceneIdsV1!.get(config.defaults.scenes.day)!,
    group.sceneIdsV1!.get(config.defaults.scenes.night)!,
  )
}

async function addScene(
  scene: Scene,
  group: ExtendedRoom | ExtendedZone,
  config: Config,
  bridge: Bridge,
) {
  const sceneIds = await bridge.addScene(
    scene.name,
    group.idV2!,
    group.groupType!,
    _.map(config.getGroupLights(group), (light) => light.idV2!),
    _.map(config.getGroupSmartPlugs(group), (plug) => plug.idV2!),
    scene.brigthness,
    scene['color-temperature'].mirek,
    scene['image-id'],
  )
  group.sceneIdsV1!.set(scene, sceneIds[0])
  group.sceneIdsV2!.set(scene, sceneIds[1])
  Logger.info(
    Color.Green,
    `Scene '${scene.name}' was created for ${group.groupType} '${group.name}' with IDs: '${group.sceneIdsV1!.get(scene)}' (v1) and '${group.sceneIdsV2!.get(scene)}' (v2)`,
  )
}
