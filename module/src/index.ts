import { Config } from './config/config'
import { Logger, Color } from './log/logger'
import { Bridge } from './bridge/bridge'
import _ from 'lodash'

main().catch((e) => {
  if (e instanceof Error) {
    Logger.error(e.message)
  } else Logger.error(e)
})

async function main() {
  Logger.setDebug(false)
  Logger.info(Color.Yellow, 'Starting ...')

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

  for (const room of config.rooms) {
    const id = await bridge.addRoom(room.name, room.type)
    room.idV2 = id
    Logger.info(
      Color.Green,
      `Room '${room.name}' was created with ID: '${room.idV2}'`,
    )
  }
  for (const zone of config.zones ?? []) {
    const id = await bridge.addZone(zone.name, zone.type)
    zone.idV2 = id
    Logger.info(
      Color.Green,
      `Zone '${zone.name}' was created with ID: '${zone.idV2}'`,
    )
  }

  // Add lights
  const lightIds = config.lights.map((light) => ({
    mac: light.mac,
    serial: light.serial,
  }))
  _.forEach(await bridge.addLights(lightIds), (lightId) => {
    const light = config.getResourceById(lightId.mac)!
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

  // Create "Default" scenes in rooms and zones
  const defaultBrightness = 100
  const defaultMirek = 323
  const defaultImageId = '732ff1d9-76a7-4630-aad0-c8acc499bb0b'
  for (const room of config.rooms) {
    const id = await bridge.addScene(
      'Default',
      room.idV2!,
      'room',
      _.map(config.getRoomLights(room), (light) => light.idV2!),
      defaultBrightness,
      defaultMirek,
      defaultImageId,
    )
    await bridge.activateScene(id)
    Logger.info(
      Color.Green,
      `Default scene was created for room '${room.name}' with ID: '${id}'`,
    )
  }
  for (const zone of config.zones ?? []) {
    const id = await bridge.addScene(
      'Default',
      zone.idV2!,
      'zone',
      _.map(config.getZoneLights(zone), (light) => light.idV2!),
      defaultBrightness,
      defaultMirek,
      defaultImageId,
    )
    await bridge.activateScene(id)
    Logger.info(
      Color.Green,
      `Default scene was created for zone '${zone.name}' with ID: '${id}'`,
    )
  }

  Logger.info(Color.Yellow, 'Done! 🙌')
}
