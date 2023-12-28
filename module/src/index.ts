import { Config } from './config/config'
import { Logger } from './log/logger'
import crypto from 'crypto'
import type from 'typia'
import { Discovery } from './api/discovery'
import { ApiV1, CreateUserParams, CreateUserSuccess } from './api/apiv1'

main().catch((e) => {
  if (e instanceof Error) {
    Logger.error(e.message)
  } else Logger.error(e)
})

async function main() {
  Logger.info('Starting ...', Logger.YELLOW)
  const bridgeManualIp = process.env.npm_config_bridge as string
  const config = new Config(
    process.env.npm_config_config as string,
    process.env.npm_config_xor as string,
  )
  config.print()
  let bridgeIpAddresses
  if (!bridgeManualIp) {
    bridgeIpAddresses = await discoverBridges()
    Logger.info(
      `Found ${bridgeIpAddresses.length} bridge(s): ${bridgeIpAddresses}`,
    )
  } else {
    Logger.info(`Provided bridge address: ${bridgeManualIp}`)
    bridgeIpAddresses = [bridgeManualIp]
  }
  const bridgeAndKey = await accessBridge(bridgeIpAddresses)
  Logger.info(`Application key: '${bridgeAndKey[1]}'`)
  Logger.info('Done!', Logger.YELLOW)
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
    const params: CreateUserParams = {
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
