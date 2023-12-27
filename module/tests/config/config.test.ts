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
  test('should print config', () => {
    new Config('./tests/config/res/encrypted-config.json').print()
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
    expect(config1.motionSensors![0].serial).toBe('0BABCDEF')
    expect(config1.motionSensors![0].mac).toBe(
      '00:17:88:01:0b:ab:cd:ef-02-0406',
    )
    expect(config1.tapDialSwitches![0].serial).toBe('0B123456')
    expect(config1.tapDialSwitches![0].mac).toBe(
      '00:17:88:01:0b:12:34:56-fc00-0014',
    )
    expect(config1.wallSwitches![0].serial).toBe('99A53A')
    expect(config1.wallSwitches![0].mac).toBe('00:17:88:01:0c:22:1e:81-01-fc00')
    expect(config1.dimmerSwitches![0].serial).toBe('98C27F')
    expect(config1.dimmerSwitches![0].mac).toBe(
      '00:17:88:01:0b:11:2d:b2-01-fc00',
    )

    const config2 = new Config(
      './tests/config/res/encrypted-config.json',
      'AB', // Short key
    )

    expect(config2.lights[0].serial).toBe('320E91')
    expect(config2.lights[1].serial).toBe(undefined)
    expect(config2.lights[0].mac).toBe('00:17:88:01:0c:89:b5:2a-0b')
    expect(config2.lights[1].mac).toBe('00:17:88:01:0c:ba:86:19-0b')
    expect(config2.motionSensors![0].serial).toBe('0B3369D4')
    expect(config2.motionSensors![0].mac).toBe(
      '00:17:88:01:0b:33:69:d4-02-0406',
    )
    expect(config2.tapDialSwitches![0].serial).toBe('0B8A906D')
    expect(config2.tapDialSwitches![0].mac).toBe(
      '00:17:88:01:0b:8a:90:6d-fc00-0014',
    )
    expect(config2.wallSwitches![0].serial).toBe('010101')
    expect(config2.wallSwitches![0].mac).toBe('00:17:88:01:0c:ba:ba:ba-01-fc00')
    expect(config2.dimmerSwitches![0].serial).toBe('006644')
    expect(config2.dimmerSwitches![0].mac).toBe(
      '00:17:88:01:0b:89:89:89-01-fc00',
    )
  })
  test('should not decrypt serials and MAC addresses when no XOR key provided', () => {
    const config = new Config('./tests/config/res/encrypted-config.json')

    expect(config.lights[0].serial).toBe('99A53A')
    expect(config.lights[1].serial).toBe(undefined)
    expect(config.lights[0].mac).toBe('00:17:88:01:0c:22:1e:81-0b')
    expect(config.lights[1].mac).toBe('00:17:88:01:0c:11:2d:b2-0b')
    expect(config.motionSensors![0].serial).toBe('0B98C27F')
    expect(config.motionSensors![0].mac).toBe('00:17:88:01:0b:98:c2:7f-02-0406')
    expect(config.tapDialSwitches![0].serial).toBe('0B213BC6')
    expect(config.tapDialSwitches![0].mac).toBe(
      '00:17:88:01:0b:21:3b:c6-fc00-0014',
    )
    expect(config.wallSwitches![0].serial).toBe('AAAAAA')
    expect(config.wallSwitches![0].mac).toBe('00:17:88:01:0c:11:11:11-01-fc00')
    expect(config.dimmerSwitches![0].serial).toBe('ABCDEF')
    expect(config.dimmerSwitches![0].mac).toBe(
      '00:17:88:01:0b:22:22:22-01-fc00',
    )
  })
})
