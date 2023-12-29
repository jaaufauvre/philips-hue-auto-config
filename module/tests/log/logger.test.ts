import { Logger, Colors } from '../../src/log/logger'

describe('Logger', () => {
  test('should print info message', () => {
    Logger.info('This is a info message')
  })

  test('should print info message with color', () => {
    Logger.info(Colors.Yellow, 'This is a info message in yellow')
    Logger.info(Colors.DarkBlue, 'This is a info message in dark blue')
    Logger.info(Colors.Green, 'This is a info message in green')
    Logger.info(Colors.LightBlue, 'This is a info message in light blue')
    Logger.info(Colors.Purple, 'This is a info message in purple')
    Logger.info(Colors.Red, 'This is a info message in red')
  })

  test('should print error message', () => {
    Logger.error('This is a error message')
  })

  test('should print debug message when DEBUG env variable set', () => {
    process.env.DEBUG = 'true'
    Logger.debug('This is a debug message')
  })

  test('should not print debug message when DEBUG env variable not set', () => {
    process.env.DEBUG = 'false'
    Logger.debug("Won't print")
  })

  test('should print debug message when setDebug called with true', () => {
    Logger.setDebug(true)
    process.env.DEBUG = 'false'
    Logger.debug('This is a debug message')
  })

  test('should not print debug message when setDebug called with false', () => {
    Logger.setDebug(false)
    process.env.DEBUG = 'false'
    Logger.debug("Won't print")
  })
})
