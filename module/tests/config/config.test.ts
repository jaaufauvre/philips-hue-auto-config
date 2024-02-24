import { Config } from '../../src/config/config'
import fs from 'fs'

describe('Config', () => {
  test('should print config', () => {
    new Config('./tests/config/res/test-config.json').print()
  })

  test('should throw Error when undefined config file path', () => {
    try {
      new Config(undefined)
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe('No config provided. Use the --config option!')
    }
  })

  test('should throw Error when null config file path', () => {
    try {
      new Config(null)
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe('No config provided. Use the --config option!')
    }
  })

  test('should throw Error when config file not found', () => {
    try {
      new Config('c:/somefile.json')
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe(
        'Unexpected token \'c\', "c:/somefile.json" is not valid JSON',
      )
    }
  })

  test('should throw Error when invalid JSON', () => {
    try {
      new Config('./tests/config/res/not-a-json.txt')
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe(
        "Unexpected token 'T', \"This isn't a JSON\" is not valid JSON",
      )
    }
  })

  test('should check `uniqueItemProperties` (AJV)', () => {
    try {
      const json = fs.readFileSync(
        './tests/config/res/test-config.json',
        'utf-8',
      )
      new Config(
        json.replace(
          '"name": "Zone for wall switch"',
          '"name": "Zone for light"',
        ),
      )
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toContain('Config is invalid')
      expect(e.message).toContain(
        'must pass \\"uniqueItemProperties\\" keyword validation',
      )
    }
  })

  test('should throw Error when light room ID not defined', () => {
    try {
      const json = fs.readFileSync(
        './tests/config/res/test-config.json',
        'utf-8',
      )
      new Config(json.replace('"room": "light_room"', '"room": "unknown_room"'))
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe("Undefined room identifier: 'unknown_room'!")
    }
  })

  test('should throw Error when light zone ID not defined', () => {
    try {
      const json = fs.readFileSync(
        './tests/config/res/test-config.json',
        'utf-8',
      )
      new Config(
        json.replace('"zones": ["light_zone"]', '"zones": ["unknown_zone"]'),
      )
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe("Undefined zone identifier: 'unknown_zone'!")
    }
  })

  test('should throw Error when duplicated ID', () => {
    try {
      const json = fs.readFileSync(
        './tests/config/res/test-config.json',
        'utf-8',
      )
      new Config(json.replace('"id": "room"', '"id": "light_zone"'))
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe('Identifiers must be unique!')
    }
  })

  test('should throw Error when invalid config', () => {
    try {
      new Config('./tests/config/res/invalid-config.json')
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toContain('Config is invalid')
      expect(e.message).toContain("must have required property 'bridge'")
    }
  })

  it.each`
    device               | what          | original_group_id
    ${'Dimmer switch'}   | ${'button 1'} | ${'ds_room1'}
    ${'Dimmer switch'}   | ${'button 2'} | ${'ds_zone1'}
    ${'Dimmer switch'}   | ${'button 3'} | ${'ds_room2'}
    ${'Dimmer switch'}   | ${'button 4'} | ${'ds_zone2'}
    ${'Wall switch'}     | ${'button 1'} | ${'ws_room'}
    ${'Wall switch'}     | ${'button 2'} | ${'ws_zone'}
    ${'Tap dial switch'} | ${'button 1'} | ${'ts_room1'}
    ${'Tap dial switch'} | ${'button 2'} | ${'ts_zone1'}
    ${'Tap dial switch'} | ${'button 3'} | ${'ts_room2'}
    ${'Tap dial switch'} | ${'button 4'} | ${'ts_zone2'}
    ${'Tap dial switch'} | ${'dial'}     | ${'ts_room3'}
    ${'Motion sensor'}   | ${'motion'}   | ${'ms_room'}
  `(
    'should throw Error when group ID not defined for $device $what',
    ({ device, what, original_group_id }) => {
      console.log(
        `should throw Error when group ID not defined for ${device} ${what}`,
      )
      try {
        const json = fs.readFileSync(
          './tests/config/res/test-config.json',
          'utf-8',
        )
        new Config(
          json.replace(`"group": "${original_group_id}"`, `"group": "unknown"`),
        )
        fail('An error was expected')
      } catch (e: any) {
        expect(e.message).toBe(`Undefined group identifier: 'unknown'!`)
      }
    },
  )

  test('should throw Error when scene group ID(s) not defined', () => {
    try {
      const json = fs.readFileSync(
        './tests/config/res/test-config.json',
        'utf-8',
      )
      new Config(
        json.replace(`"groups": ["scene_zone"]`, `"groups": ["unknown"]`),
      )
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe(`Undefined group identifier: 'unknown'!`)
    }
  })

  test('should throw Error when action target ID not defined', () => {
    try {
      const json = fs.readFileSync(
        './tests/config/res/test-config.json',
        'utf-8',
      )
      new Config(json.replace(`"target": "scene_light"`, `"target": "unknown"`))
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe(`Undefined light identifier: 'unknown'!`)
    }
  })

  test('should throw Error when light action ID not defined', () => {
    try {
      const json = fs.readFileSync(
        './tests/config/res/test-config.json',
        'utf-8',
      )
      new Config(
        json.replace(
          `"light-action": "scene_action"`,
          `"light-action": "unknown"`,
        ),
      )
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe(`Undefined resource identifier: 'unknown'!`)
    }
  })

  test('should throw Error when motion sensor and missing motion sensor scene', () => {
    try {
      const json = fs.readFileSync(
        './tests/config/res/test-config.json',
        'utf-8',
      )
      const obj = JSON.parse(json)
      delete obj['defaults']['scenes']['motion-sensor-night']
      new Config(JSON.stringify(obj))
      fail('An error was expected')
    } catch (e: any) {
      expect(e.message).toBe('Missing motion sensor scene definition!')
    }
  })

  test('should decrypt serials and MAC addresses when XOR key provided', () => {
    const config1 = new Config(
      './tests/config/res/test-config.json',
      '330F9015', // Long enough key
    )

    expect(config1.lights[0].serial).toBe('AAAAAA')
    expect(config1.lights[1].serial).toBe(undefined)
    expect(config1.lights[0].mac).toBe('00:17:88:01:0c:11:11:11-0b')
    expect(config1.lights[1].mac).toBe('00:17:88:01:0c:22:22:22-0b')
    expect(config1.motionSensors![0].serial).toBe('0BABCDEF')
    expect(config1.motionSensors![0].mac).toBe('00:17:88:01:0b:ab:cd:ef-02')
    expect(config1.tapDialSwitches![0].serial).toBe('0B123456')
    expect(config1.tapDialSwitches![0].mac).toBe('00:17:88:01:0b:12:34:56-fc00')
    expect(config1.wallSwitches![0].mac).toBe('00:17:88:01:0c:22:1e:81-01-fc00')
    expect(config1.dimmerSwitches![0].serial).toBe('98C27F')
    expect(config1.dimmerSwitches![0].mac).toBe(
      '00:17:88:01:0b:11:2d:b2-01-fc00',
    )

    const config2 = new Config(
      './tests/config/res/test-config.json',
      'AB', // Short key
    )

    expect(config2.lights[0].serial).toBe('320E91')
    expect(config2.lights[1].serial).toBe(undefined)
    expect(config2.lights[0].mac).toBe('00:17:88:01:0c:89:b5:2a-0b')
    expect(config2.lights[1].mac).toBe('00:17:88:01:0c:ba:86:19-0b')
    expect(config2.motionSensors![0].serial).toBe('0B3369D4')
    expect(config2.motionSensors![0].mac).toBe('00:17:88:01:0b:33:69:d4-02')
    expect(config2.tapDialSwitches![0].serial).toBe('0B8A906D')
    expect(config2.tapDialSwitches![0].mac).toBe('00:17:88:01:0b:8a:90:6d-fc00')
    expect(config2.wallSwitches![0].mac).toBe('00:17:88:01:0c:ba:ba:ba-01-fc00')
    expect(config2.dimmerSwitches![0].serial).toBe('006644')
    expect(config2.dimmerSwitches![0].mac).toBe(
      '00:17:88:01:0b:89:89:89-01-fc00',
    )
  })

  test('should not decrypt serials and MAC addresses when no XOR key provided', () => {
    const config = new Config('./tests/config/res/test-config.json')

    expect(config.lights[0].serial).toBe('99A53A')
    expect(config.lights[1].serial).toBe(undefined)
    expect(config.lights[0].mac).toBe('00:17:88:01:0c:22:1e:81-0b')
    expect(config.lights[1].mac).toBe('00:17:88:01:0c:11:2d:b2-0b')
    expect(config.motionSensors![0].serial).toBe('0B98C27F')
    expect(config.motionSensors![0].mac).toBe('00:17:88:01:0b:98:c2:7f-02')
    expect(config.tapDialSwitches![0].serial).toBe('0B213BC6')
    expect(config.tapDialSwitches![0].mac).toBe('00:17:88:01:0b:21:3b:c6-fc00')
    expect(config.wallSwitches![0].mac).toBe('00:17:88:01:0c:11:11:11-01-fc00')
    expect(config.dimmerSwitches![0].serial).toBe('ABCDEF')
    expect(config.dimmerSwitches![0].mac).toBe(
      '00:17:88:01:0b:22:22:22-01-fc00',
    )
  })

  it.each`
    resource           | id                                   | expected_name
    ${'light'}         | ${'99A53A'}                          | ${'Light 1'}
    ${'light'}         | ${'light2'}                          | ${'Light 2'}
    ${'light'}         | ${'00:17:88:01:0c:11:2d:b2-0b'}      | ${'Light 2'}
    ${'room'}          | ${'room'}                            | ${'Room'}
    ${'zone'}          | ${'light_zone'}                      | ${'Zone for light'}
    ${'wall switch'}   | ${'wallswitch'}                      | ${'Wall switch'}
    ${'wall switch'}   | ${'00:17:88:01:0c:11:11:11-01-fc00'} | ${'Wall switch'}
    ${'tap dial'}      | ${'dial'}                            | ${'Tap dial'}
    ${'tap dial'}      | ${'0B213BC6'}                        | ${'Tap dial'}
    ${'tap dial'}      | ${'00:17:88:01:0b:21:3b:c6-fc00'}    | ${'Tap dial'}
    ${'motion sensor'} | ${'motion_sensor'}                   | ${'Motion sensor'}
    ${'motion sensor'} | ${'0B98C27F'}                        | ${'Motion sensor'}
    ${'motion sensor'} | ${'00:17:88:01:0b:98:c2:7f-02'}      | ${'Motion sensor'}
    ${'dimmer switch'} | ${'dimmerswitch'}                    | ${'Dimmer switch'}
    ${'dimmer switch'} | ${'ABCDEF'}                          | ${'Dimmer switch'}
    ${'dimmer switch'} | ${'00:17:88:01:0b:22:22:22-01-fc00'} | ${'Dimmer switch'}
    ${'scene'}         | ${'scene'}                           | ${'Scene'}
    ${'scene action'}  | ${'scene_action'}                    | ${'Action'}
    ${'scene action'}  | ${'day_action'}                      | ${'Default day action'}
    ${'scene action'}  | ${'night_action'}                    | ${'Default night action'}
    ${'scene action'}  | ${'evening_action'}                  | ${'Default evening action'}
    ${'scene action'}  | ${'sensor_day_action'}               | ${'Default sensor day action'}
    ${'scene action'}  | ${'sensor_night_action'}             | ${'Default sensor night action'}
    ${'scene action'}  | ${'sensor_evening_action'}           | ${'Default sensor evening action'}
  `(
    'should return $resource "$expected_name" for ID "$id"',
    ({ resource, id, expected_name }) => {
      console.log(`should return ${resource} ${expected_name} for ID ${id}`)
      const config = new Config('./tests/config/res/test-config.json')
      expect(config.getResourceById(id)!.name).toBe(expected_name)
    },
  )

  test('should return a list of resource mac addresses', () => {
    const config = new Config('./tests/config/res/test-config.json')
    expect(config.getAllResourceMacs().length).toBe(10)
  })

  test('should return room lights', () => {
    const config = new Config('./tests/config/res/test-config.json')
    expect(config.getGroupLights(config.rooms[0]).length).toBe(3)
  })

  test('should return zone lights', () => {
    const config = new Config('./tests/config/res/test-config.json')
    expect(config.getGroupLights(config.zones![0]).length).toBe(1)
  })

  test('should return default scenes for accessory configs when no scenes defined', () => {
    const config = new Config('./tests/config/res/test-config.json')
    const dimmerButton = config.dimmerSwitches[0].button1
    expect(config.getDaySceneId(dimmerButton)).toBe('default-day-scene')
    expect(config.getNightSceneId(dimmerButton)).toBe('default-night-scene')
    expect(config.getEveningSceneId(dimmerButton)).toBe('default-evening-scene')
    const sensorMotion = config.motionSensors[0].motion
    expect(config.getSensorDaySceneId(sensorMotion)).toBe(
      'default-sensor-day-scene',
    )
    expect(config.getSensorNightSceneId(sensorMotion)).toBe(
      'default-sensor-night-scene',
    )
    expect(config.getSensorEveningSceneId(sensorMotion)).toBe(
      'default-sensor-evening-scene',
    )
  })

  test('should return default scene for accessory configs when default scene defined', () => {
    const config = new Config('./tests/config/res/test-config.json')
    const dimmerButton = config.dimmerSwitches[0].button4
    expect(config.getDaySceneId(dimmerButton)).toBe('scene')
    expect(config.getNightSceneId(dimmerButton)).toBe('scene')
    expect(config.getEveningSceneId(dimmerButton)).toBe('scene')
    const sensorMotion = config.motionSensors[1].motion
    expect(config.getSensorDaySceneId(sensorMotion)).toBe('scene')
    expect(config.getSensorNightSceneId(sensorMotion)).toBe('scene')
    expect(config.getSensorEveningSceneId(sensorMotion)).toBe('scene')
  })

  test('should return scenes for accessory configs when scenes defined', () => {
    const config = new Config('./tests/config/res/test-config.json')
    const dimmerButton = config.dimmerSwitches[0].button3
    expect(config.getDaySceneId(dimmerButton)).toBe('day_scene')
    expect(config.getNightSceneId(dimmerButton)).toBe('night_scene')
    expect(config.getEveningSceneId(dimmerButton)).toBe('evening_scene')
    const sensorMotion = config.motionSensors[2].motion
    expect(config.getSensorDaySceneId(sensorMotion)).toBe('day_scene')
    expect(config.getSensorNightSceneId(sensorMotion)).toBe('night_scene')
    expect(config.getSensorEveningSceneId(sensorMotion)).toBe('evening_scene')
  })
})

function fail(msg: string) {
  expect(`Test failed: ${msg}`).toBeFalsy()
}
