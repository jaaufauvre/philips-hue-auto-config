import { Logger, Color } from '../../src/log/logger'

describe('Logger', () => {
  test('should print info message', () => {
    Logger.info('This is a info message')
  })

  test('should print info message with color', () => {
    Logger.info(Color.Yellow, 'This is a info message in yellow')
    Logger.info(Color.DarkBlue, 'This is a info message in dark blue')
    Logger.info(Color.Green, 'This is a info message in green')
    Logger.info(Color.LightBlue, 'This is a info message in light blue')
    Logger.info(Color.Purple, 'This is a info message in purple')
    Logger.info(Color.Red, 'This is a info message in red')
  })

  test('should print error message', () => {
    Logger.error('This is a error message')
  })

  test('should print warning message', () => {
    Logger.warn('This is a warning message')
  })

  test('should print debug message when DEBUG env variable set', () => {
    process.env.DEBUG = 'true'
    Logger.debug('This is a debug message (DEBUG is true)')
  })

  test('should not print debug message when DEBUG env variable not set', () => {
    process.env.DEBUG = 'false'
    Logger.debug("Won't print")
  })

  test('should print debug message when setDebug called with true', () => {
    Logger.setDebug(true)
    process.env.DEBUG = 'false'
    Logger.debug('This is a debug message (setDebug is true)')
  })

  test('should not print debug message when setDebug called with false', () => {
    Logger.setDebug(false)
    process.env.DEBUG = 'false'
    Logger.debug("Won't print")
  })

  test('should properly log object', () => {
    const object = [{ something: 'value1' }, { something: 'value2' }]
    Logger.info(Color.Yellow, 'Object:', object)
    Logger.info('Object:', object)
  })

  test('should render table', () => {
    const object = [{ something: 'value1' }, { something: 'value2' }]
    Logger.table(object)
  })
})
