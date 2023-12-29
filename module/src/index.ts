import { Config } from './config/config'
import { Logger, Colors } from './log/logger'
import crypto from 'crypto'
import type from 'typia'
import { Discovery } from './api/discovery'
import { ApiV1, CreateUserSuccess } from './api/api-v1'
import { ApiV2 } from './api/api-v2'

main().catch((e) => {
  if (e instanceof Error) {
    Logger.error(e.message)
  } else Logger.error(e)
})

async function main() {
  Logger.setDebug(false)
  Logger.info(Colors.Yellow, 'Starting ...')

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
    bridgeIpAddresses = await discoverBridges()
    Logger.info(
      `Found ${bridgeIpAddresses.length} bridge(s): ${bridgeIpAddresses}`,
    )
  } else {
    Logger.info(`Provided bridge address: ${providedBridgeIp}`)
    bridgeIpAddresses = [providedBridgeIp]
  }

  // User creation?
  let bridgeIp, appKey
  if (providedAppKey && providedBridgeIp) {
    bridgeIp = providedBridgeIp
    appKey = providedAppKey
    Logger.info(`Provided app key for bridge ${bridgeIp}: '${appKey}'`)
  } else {
    const result = await accessBridge(bridgeIpAddresses)
    bridgeIp = result[0]
    appKey = result[1]
    Logger.info(`Created app key for bridge ${bridgeIp}: '${appKey}'`)
  }

  // Rooms
  const apiv2 = new ApiV2(bridgeIp, appKey)
  for (const room of config.rooms) {
    const created = await apiv2.createRoom({
      type: 'room',
      metadata: {
        name: room.name,
        archetype: room.type ?? 'other',
      },
      children: [],
    })
    Logger.info(
      `Room '${room.name}' was created with ID: '${created.data[0].rid}'`,
    )
  }
  Logger.info(Colors.Yellow, 'Done!')
}

async function discoverBridges() {
  const bridges = await new Discovery().discover()
  return bridges.map((bridge) => bridge.internalipaddress)
}

async function accessBridge(
  bridgeIpAddresses: string[],
): Promise<[string, string]> {
  for (const bridgeIpAddress of bridgeIpAddresses) {
    Logger.info(`Trying to access bridge ${bridgeIpAddress} ...`)
    const params = {
      devicetype: `philips-hue-auto-config#${crypto
        .randomBytes(6)
        .toString('hex')}`, // "a83eb079e766"
      generateclientkey: true,
    }
    const response = await new ApiV1(bridgeIpAddress).createUser(params)
    if (type.is<CreateUserSuccess>(response)) {
      return [bridgeIpAddress, response[0].success.username]
    } else {
      Logger.info(`Could not access bridge ${bridgeIpAddress}!`)
    }
  }
  throw Error('Make sure your pressed the button in the centre of the bridge!')
}
