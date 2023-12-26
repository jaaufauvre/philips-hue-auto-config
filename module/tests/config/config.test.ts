import { Config } from '../../src/config/config'

describe('Config', () => {
  test('should throw Error when undefined config file path', () => {
    try {
      new Config(undefined)
      fail()
    } catch (e: any) {
      expect(e.message).toBe('No config provided. Use the --config option!')
    }
  })
  test('should throw Error when null config file path', () => {
    try {
      new Config(null)
      fail()
    } catch (e: any) {
      expect(e.message).toBe('No config provided. Use the --config option!')
    }
  })
  test('should throw Error when config file not found', () => {
    try {
      new Config('c:/somefile.json')
      fail()
    } catch (e: any) {
      expect(e.message).toBe('c:/somefile.json not found!')
    }
  })
  test('should throw Error when invalid JSON', () => {
    try {
      new Config('./tests/config/res/not-a-json.txt')
      fail()
    } catch (e: any) {
      expect(e.message).toBe('Could not parse config!')
    }
  })
  test('should throw Error when invalid config', () => {
    try {
      new Config('./tests/config/res/invalid-config.json')
      fail()
    } catch (e: any) {
      expect(e.message).toContain('Config is invalid. Errors:')
    }
  })
  test('should decrypt serials and MAC addresses when XOR key provided', () => {
    const config1 = new Config(
      './tests/config/res/encrypted-config.json',
      '330F9015', // Long enough key
    )

    expect(config1.lights[0].serial).toBe('AAAAAA')
    expect(config1.lights[1].serial).toBe(undefined)
    expect(config1.lights[0].mac).toBe('00:17:88:01:0c:11:11:11-0b')
    expect(config1.lights[1].mac).toBe('00:17:88:01:0c:22:22:22-0b')
    expect(config1['motion-sensors']![0].serial).toBe('0BABCDEF')
    expect(config1['motion-sensors']![1].serial).toBe('0B123456')
    expect(config1['motion-sensors']![0].mac).toBe(
      '00:17:88:01:0b:ab:cd:ef-02-0406',
    )
    expect(config1['motion-sensors']![1].mac).toBe(
      '00:17:88:01:0b:12:34:56-02-0406',
    )

    const config2 = new Config(
      './tests/config/res/encrypted-config.json',
      'AB', // Short key
    )

    expect(config2.lights[0].serial).toBe('320E91')
    expect(config2.lights[1].serial).toBe(undefined)
    expect(config2.lights[0].mac).toBe('00:17:88:01:0c:89:b5:2a-0b')
    expect(config2.lights[1].mac).toBe('00:17:88:01:0c:ba:86:19-0b')
    expect(config2['motion-sensors']![0].serial).toBe('0B3369D4')
    expect(config2['motion-sensors']![1].serial).toBe('0B8A906D')
    expect(config2['motion-sensors']![0].mac).toBe(
      '00:17:88:01:0b:33:69:d4-02-0406',
    )
    expect(config2['motion-sensors']![1].mac).toBe(
      '00:17:88:01:0b:8a:90:6d-02-0406',
    )
  })
})
