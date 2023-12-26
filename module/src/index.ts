import { Config } from './config/config'
import { Logger } from './log/logger'

try {
  main()
} catch (e: any) {
  if (e instanceof Error) {
    Logger.error(e.message)
  } else Logger.error(e)
}

function main() {
  Logger.info('Starting...', Logger.YELLOW)
  const config = new Config(
    process.env.npm_config_config as string,
    process.env.npm_config_xor as string,
  )
  Logger.info(`${config.lights.length} light(s)`)
  Logger.info(`${config.rooms.length} room(s)`)
  Logger.info(`${(config.zones ?? []).length} zones(s)`)
  Logger.info(`${(config.motionSensors ?? []).length} motion sensor(s)`)
  Logger.info(`${(config.tapDialSwitches ?? []).length} tap dial switch(es)`)
  Logger.info(`${(config.dimmerSwitches ?? []).length} dimmer switch(es)`)
  Logger.info(`${(config.wallSwitches ?? []).length} wall switch(es)`)
  Logger.info('Done!', Logger.YELLOW)
}
