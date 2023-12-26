import { Logger } from '../../src/log/logger'

describe('Logger', () => {
  test('should print info message', () => {
    Logger.info('This is a info message')
  })

  test('should print info message with color', () => {
    Logger.info('This is a info message in yellow', Logger.YELLOW)
    Logger.info('This is a info message in dark blue', Logger.DARK_BLUE)
    Logger.info('This is a info message in green', Logger.GREEN)
    Logger.info('This is a info message in light blue', Logger.LIGHT_BLUE)
    Logger.info('This is a info message in purple', Logger.PURPLE)
    Logger.info('This is a info message in red', Logger.RED)
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
    Logger.debug('This is a debug message')
  })
})
