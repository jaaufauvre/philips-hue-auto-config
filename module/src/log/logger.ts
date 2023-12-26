/**
 * A simple logger with timestamp and colors.
 * Set the DEBUG env variable to get "debug" logs.
 */
export class Logger {
  static RED = '\x1b[31m%s\x1b[0m'
  static GREEN = '\x1b[32m%s\x1b[0m'
  static YELLOW = '\x1b[33m%s\x1b[0m'
  static DARK_BLUE = '\x1b[34m%s\x1b[0m'
  static PURPLE = '\x1b[35m%s\x1b[0m'
  static LIGHT_BLUE = '\x1b[36m%s\x1b[0m'

  static #log = (msg: string, color?: string) => {
    const logMsg = `${new Date().toISOString()} - ${msg}`
    if (color) {
      console.log(color, logMsg)
    } else {
      console.log(logMsg)
    }
  }

  static info = (obj: any, color?: string) => {
    Logger.#log(Logger.toString(obj), color)
  }

  static error = (obj: any) => {
    Logger.#log(`[Error] ${Logger.toString(obj)}`, Logger.RED)
  }

  static debug = (obj: any) => {
    if (process.env.DEBUG == 'true') {
      Logger.#log(`[Debug] ${Logger.toString(obj)}`)
    }
  }

  static toString(obj: any): string {
    if (typeof obj === 'string') {
      return obj
    }
    return JSON.stringify(obj, null, 2)
  }
}
