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
  config.print()
  Logger.info('Done!', Logger.YELLOW)
}
