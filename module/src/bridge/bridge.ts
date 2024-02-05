import { Logger, Color } from '../log/logger'
import crypto from 'crypto'
import type from 'typia'
import { Discovery } from '../api/discovery'
import _ from 'lodash'
import {
  Action,
  ApiV1,
  CreateUserSuccess,
  NewRule,
  RuleV1,
  SensorsV1,
} from '../api/api-v1'
import { ApiV2, Device, UpdatedDevice } from '../api/api-v2'

export class Bridge {
  #apiv1?: ApiV1
  #apiv2?: ApiV2

  init(bridgeIp: string, appKey: string) {
    this.#apiv1 = new ApiV1(bridgeIp, appKey)
    this.#apiv2 = new ApiV2(bridgeIp, appKey)
  }

  static async discoverBridges() {
    const bridges = await new Discovery().discover()
    return bridges.map((bridge) => bridge.internalipaddress)
  }

  static async findAndAccessBridge(
    bridgeIpAddresses: string[],
  ): Promise<[string, string]> {
    for (const bridgeIpAddress of bridgeIpAddresses) {
      Logger.info(`Trying to access bridge ${bridgeIpAddress} ...`)
      const params = {
        devicetype: `philips-hue-auto-config#${crypto
          .randomBytes(6)
          .toString('hex')}`, // "a83eb079e766"
        generateclientkey: true,
      }
      const apiv1 = new ApiV1(bridgeIpAddress)
      const response = await apiv1.createUser(params)
      if (type.is<CreateUserSuccess>(response)) {
        return [bridgeIpAddress, response[0].success.username]
      } else {
        Logger.info(`Could not access bridge ${bridgeIpAddress}!`)
      }
    }
    throw Error(
      'Make sure your pressed the button in the centre of the bridge!',
    )
  }

  async resetBridge() {
    for (const ruleId of Object.keys(await this.#apiv1!.getRules())) {
      await this.#apiv1!.deleteRule(ruleId)
    }
    for (const behaviorInstance of (await this.#apiv2!.getBehaviorInstances())
      .data) {
      await this.#apiv2!.deleteBehaviorInstance(behaviorInstance.id)
    }
    for (const room of (await this.#apiv2!.getRooms()).data) {
      await this.#apiv2!.deleteRoom(room.id)
    }
    for (const zone of (await this.#apiv2!.getZones()).data) {
      await this.#apiv2!.deleteZone(zone.id)
    }
    for (const linkId of Object.keys(await this.#apiv1!.getResourcelinks())) {
      await this.#apiv1!.deleteResourcelink(linkId)
    }
    for (const sceneId of Object.keys(await this.#apiv1!.getScenes())) {
      await this.#apiv1!.deleteScene(sceneId)
    }
  }

  async resetBridgeWithDevices() {
    await this.resetBridge()
    for (const light of (await this.#apiv2!.getLights()).data) {
      await this.#apiv2!.deleteDevice(light.owner.rid)
    }
    for (const device of (await this.#getDevices()).data) {
      if (!this.#isBridge(device)) {
        await this.#apiv2!.deleteDevice(device.id)
      }
    }
    for (const sensorId of Object.keys(await this.#apiv1!.getSensors())) {
      await this.#apiv1!.deleteSensor(sensorId)
    }
  }

  async deleteUnexpectedLights(excludedMacAddresses: string[]) {
    while (await this.#isScanningLights()) {
      Logger.info(Color.DarkBlue, 'Waiting for light scan to end ...')
      await this.#wait(10000)
    }
    const lightsV1 = await this.#apiv1!.getLights()
    for (const id of Object.keys(lightsV1)) {
      const light = lightsV1[id]
      if (!_.includes(excludedMacAddresses, light.uniqueid)) {
        Logger.info(`Deleting unexpected light '${light.uniqueid}' ...`)
        await this.#apiv1!.deleteLight(id)
      }
    }
  }

  async deleteUnexpectedAccessories(excludedMacAddresses: string[]) {
    while (await this.#isScanningSensors()) {
      Logger.info(Color.DarkBlue, 'Waiting for accessory scan to end ...')
      await this.#wait(10000)
    }
    const sensorsV1 = await this.#apiv1!.getSensors()
    for (const id of Object.keys(sensorsV1)) {
      const sensor = sensorsV1[id]
      if (
        !_.some(
          excludedMacAddresses,
          (macAddress) =>
            !sensor.uniqueid || sensor.uniqueid.startsWith(macAddress),
        )
      ) {
        Logger.info(`Deleting unexpected sensor '${sensor.uniqueid}' ...`)
        await this.#apiv1!.deleteSensor(id)
      }
    }
  }

  async updateBridgeName(name: string) {
    Logger.info(`Updating bridge name to ${name} ...`)
    const bridgeId = (await this.#getDevices(['Hue Bridge'])).data[0].id
    const device = {
      metadata: {
        name: name,
      },
    }
    await this.#updateDevice(bridgeId, device)
  }

  async updateBridgeLocation(lat: string, long: string) {
    Logger.info('Updating bridge location ...')
    const daylightSensorId = Object.keys(
      await this.#getSensors(['Daylight']),
    )[0]
    await this.#apiv1!.updateDaylightSensorConfig(daylightSensorId, {
      long: long,
      lat: lat,
      sunriseoffset: -30, // "daylight" value is "true" 30min before sunrise
      sunsetoffset: 30, // "daylight" value is "false" 30min after sunset
    })
  }

  async addRoom(name: string, archetype?: string) {
    if (await this.#hasRoom(name)) {
      // Rooms can have the same name
      throw new Error(`Room '${name}' already exists!`)
    }
    const created = await this.#apiv2!.createRoom({
      type: 'room',
      metadata: {
        name: name,
        archetype: archetype ?? 'other',
      },
      children: [],
    })
    const idV2 = created.data[0].rid
    const groupIdV1 = (await this.#apiv2!.getRoom(idV2)).data[0].id_v1 // "/groups/81"
    const idV1 = groupIdV1.replace('/groups/', '')
    return [idV1, idV2]
  }

  async addZone(name: string, archetype?: string) {
    if (await this.#hasZone(name)) {
      // Zones can have the same name
      throw new Error(`Zone '${name}' already exists!`)
    }
    const created = await this.#apiv2!.createZone({
      type: 'zone',
      metadata: {
        name: name,
        archetype: archetype ?? 'other',
      },
      children: [],
    })
    const idV2 = created.data[0].rid
    const groupIdV1 = (await this.#apiv2!.getZone(idV2)).data[0].id_v1 // "/groups/81"
    const idV1 = groupIdV1.replace('/groups/', '')
    return [idV1, idV2]
  }

  async addLights(
    lightIdList: LightIdentifiers[],
  ): Promise<LightIdentifiers[]> {
    Logger.info('Adding lights ...')
    Logger.table(lightIdList)

    while (await this.#hasMissingLights(lightIdList)) {
      // Search without serial
      await this.#apiv1!.searchLights({ deviceid: [] })
      while (
        (await this.#isScanningLights()) &&
        (await this.#hasMissingLights(lightIdList))
      ) {
        Logger.info(Color.DarkBlue, 'Scan is in progress ...')
        await this.#wait(10000)
      }
      const missingLightIdList = await this.#findMissingLights(lightIdList)
      if (_.isEmpty(missingLightIdList)) {
        break
      }
      for (const missingLightId of missingLightIdList) {
        if (!missingLightId.serial) {
          Logger.warn(
            `Light ${missingLightId.mac} wasn't found and no serial was provided`,
          )
          continue
        }
        // Search one by one by serial
        const serial = missingLightId.serial
        Logger.info(`Searching for serial ${serial}`)
        await this.#apiv1!.searchLights({ deviceid: [serial] })
        while (
          (await this.#isScanningLights()) &&
          !(await this.#hasLight(missingLightId.mac)) &&
          (await this.#hasMissingLights(lightIdList))
        ) {
          Logger.info(Color.DarkBlue, 'Scan with serial is in progress ...')
          await this.#wait(10000)
        }
      }
    }
    // Find created IDs
    const lightsV1 = await this.#apiv1!.getLights()
    const lightsV2 = await this.#apiv2!.getLights()
    const finalLightIdList = _.cloneDeep(lightIdList)
    _.forEach(finalLightIdList, (lightId) => {
      lightId.id_v1 = _.find(
        Object.keys(lightsV1),
        (key) => lightsV1[key].uniqueid === lightId.mac,
      )
      const light = _.find(
        lightsV2.data,
        (light) => light.id_v1 === `/lights/${lightId.id_v1}`,
      )
      lightId.id_v2 = light!.id
      lightId.ownerId = light!.owner.rid
    })
    return finalLightIdList
  }

  async addLightToRoom(lightOwnerIdV2: string, roomIdV2: string) {
    Logger.info(
      `Adding light owned by '${lightOwnerIdV2}' to room '${roomIdV2}'`,
    )
    const children = (await this.#apiv2!.getRoom(roomIdV2)).data[0].children
    children.push({
      rid: lightOwnerIdV2,
      rtype: 'device',
    })
    const room = {
      children: children,
    }
    await this.#apiv2!.updateRoom(roomIdV2, room)
  }

  async addLightToZone(lightIdV2: string, zoneIdV2: string) {
    Logger.info(`Adding light '${lightIdV2}' to zone '${zoneIdV2}'`)
    const children = (await this.#apiv2!.getZone(zoneIdV2)).data[0].children
    children.push({
      rid: lightIdV2,
      rtype: 'light',
    })
    const zone = {
      children: children,
    }
    await this.#apiv2!.updateZone(zoneIdV2, zone)
  }

  async updateLightMetadata(
    lightOwnerIdV2: string,
    name: string,
    type?: string,
  ) {
    Logger.info(`Updating metadata for light owner '${lightOwnerIdV2}'`)
    const device = {
      metadata: {
        name: name,
        archetype: type ?? 'unknown_archetype',
      },
    }
    await this.#updateDevice(lightOwnerIdV2, device)
  }

  async updateLightPowerUp(idV2: string, preset: string) {
    Logger.info(`Updating power up behavior for light '${idV2}' to '${preset}'`)
    const light = {
      powerup: {
        preset: preset,
      },
    }
    await this.#apiv2!.updateLight(idV2, light)
  }

  async addScene(
    name: string,
    groupIdV2: string,
    groupType: string,
    lightIds: string[],
    smartPlugIds: string[],
    brightness: number,
    mirek: number,
    imageId: string,
  ) {
    Logger.info(`Adding scene '${name}' to ${groupType} '${groupIdV2}'`)
    const lightOnActions = _.map(lightIds, (id) => {
      return {
        target: {
          rid: id,
          rtype: 'light',
        },
        action: {
          on: {
            on: true,
          },
          dimming: {
            brightness: brightness,
          },
          color_temperature: {
            mirek: mirek,
          },
        },
      }
    })
    const smartPlugOnActions = _.map(smartPlugIds, (id) => {
      return {
        target: {
          rid: id,
          rtype: 'light',
        },
        action: {
          on: {
            on: true,
          },
        },
      }
    })
    const created = await this.#apiv2!.createScene({
      type: 'scene',
      metadata: {
        name: name,
        image: {
          rid: imageId,
          rtype: 'public_image',
        },
      },
      group: {
        rid: groupIdV2,
        rtype: groupType,
      },
      actions: _.concat(smartPlugOnActions, lightOnActions),
    })

    const idV2 = created.data[0].rid
    const sceneIdV1 = (await this.#apiv2!.getScene(idV2)).data[0].id_v1 // "/scenes/FVQmKmwq2L-adLtW"
    const idV1 = sceneIdV1.replace('/scenes/', '')
    return [idV1, idV2]
  }

  async activateScene(idV2: string) {
    Logger.info(`Activating scene '${idV2}'`)
    await this.#apiv2!.updateScene(idV2, { recall: { action: 'active' } })
  }

  async addAccessories(
    accessoryIdList: AccessoryIdentifiers[],
  ): Promise<AccessoryIdentifiers[]> {
    Logger.info('Adding accessories:')
    Logger.table(accessoryIdList)
    // All all
    await this.#searchAccessories(accessoryIdList)
    // Find created IDs
    const sensorsV1 = await this.#getSensors()
    const devicesV2 = await this.#getDevices()
    const finalIdList = _.cloneDeep(accessoryIdList)
    _.forEach(finalIdList, (accessoryId) => {
      accessoryId.id_v1 = this.#findSensorIdByAddressAndType(
        sensorsV1,
        accessoryId.mac,
        'ZLLSwitch',
      )
      const accessory = _.find(
        devicesV2.data,
        (device) => device.id_v1 === `/sensors/${accessoryId.id_v1}`,
      )
      accessoryId.id_v2 = accessory!.id
    })
    return finalIdList
  }

  async addTapDialSwitches(
    tapDialSwitchIdList: TapDialSwitchIdentifiers[],
  ): Promise<TapDialSwitchIdentifiers[]> {
    Logger.info('Adding tap dial switches:')
    Logger.table(tapDialSwitchIdList)
    // All all
    await this.#searchAccessories(tapDialSwitchIdList)
    // Find created IDs
    const sensorsV1 = await this.#getSensors()
    const devicesV2 = await this.#getDevices()
    const finalIdList = _.cloneDeep(tapDialSwitchIdList)
    _.forEach(finalIdList, (tapDialSwitchId) => {
      tapDialSwitchId.switch_id_v1 = this.#findSensorIdByAddressAndType(
        sensorsV1,
        tapDialSwitchId.mac,
        'ZLLSwitch',
      )
      tapDialSwitchId.dial_id_v1 = this.#findSensorIdByAddressAndType(
        sensorsV1,
        tapDialSwitchId.mac,
        'ZLLRelativeRotary',
      )
      const tapDialSwitch = _.find(
        devicesV2.data,
        (device) => device.id_v1 === `/sensors/${tapDialSwitchId.dial_id_v1}`,
      )
      tapDialSwitchId.id_v2 = tapDialSwitch!.id
    })
    return finalIdList
  }

  async addMotionSensors(
    motionSensorIdList: MotionSensorIdentifiers[],
  ): Promise<MotionSensorIdentifiers[]> {
    Logger.info('Adding motion sensors:')
    Logger.table(motionSensorIdList)
    // All all
    await this.#searchAccessories(motionSensorIdList)
    // Find created IDs
    const sensorsV1 = await this.#getSensors()
    const devicesV2 = await this.#getDevices()
    const finalIdList = _.cloneDeep(motionSensorIdList)
    _.forEach(finalIdList, (motionSensorId) => {
      motionSensorId.light_id_v1 = this.#findSensorIdByAddressAndType(
        sensorsV1,
        motionSensorId.mac,
        'ZLLLightLevel',
      )
      motionSensorId.presence_id_v1 = this.#findSensorIdByAddressAndType(
        sensorsV1,
        motionSensorId.mac,
        'ZLLPresence',
      )
      motionSensorId.temperature_id_v1 = this.#findSensorIdByAddressAndType(
        sensorsV1,
        motionSensorId.mac,
        'ZLLTemperature',
      )
      const motionSensor = _.find(
        devicesV2.data,
        (device) =>
          device.id_v1 === `/sensors/${motionSensorId.presence_id_v1}`,
      )
      motionSensorId.id_v2 = motionSensor!.id
    })
    return finalIdList
  }

  async updateWallSwitchProperties(idV2: string, name: string, mode: string) {
    Logger.info(`Updating wall switch '${idV2}', mode '${mode}'`)
    while (await this.#isWallSwitchUpdating(idV2)) {
      Logger.info(`Wall switch '${idV2}' isn't ready ...`)
      await this.#wait(5000)
    }
    const device = {
      metadata: {
        name: name,
      },
      device_mode: {
        mode: mode,
      },
    }
    while (!(await this.#isWallSwitchUpdated(idV2, mode, name))) {
      await this.#updateDevice(idV2, device)
      Logger.info(`Wall switch '${idV2}' update is in progress ...`)
      await this.#wait(5000)
    }
  }

  async updateDimmerSwitchProperties(idV2: string, name: string) {
    Logger.info(`Updating dimmer switch '${idV2}'`)
    const device = {
      metadata: {
        name: name,
      },
    }
    await this.#updateDevice(idV2, device)
  }

  async updateTapDialSwitchProperties(
    switchIdV1: string,
    dialIdV1: string,
    idV2: string,
    name: string,
  ) {
    Logger.info(`Updating tap dial switch '${idV2}'`)
    const device = {
      metadata: {
        name: name,
      },
    }
    const dialSensor = {
      name: `${name} (R)`,
    }
    const switchSensor = {
      name: `${name} (S)`,
    }
    await this.#apiv1!.updateSensor(dialIdV1, dialSensor)
    await this.#apiv1!.updateSensor(switchIdV1, switchSensor)
    await this.#updateDevice(idV2, device)
  }

  async updateMotionSensorProperties(
    temperatureIdV1: string,
    lightIdV1: string,
    presenceIdV1: string,
    idV2: string,
    name: string,
  ) {
    Logger.info(`Updating motion sensor '${idV2}'`)
    const device = {
      metadata: {
        name: name,
      },
    }
    const temperatureSensor = {
      name: `${name} (T)`,
    }
    const lightSensor = {
      name: `${name} (L)`,
      config: {
        tholddark: 25000, // Medium
      },
    }
    const presenceSensor = {
      name: `${name} (P)`,
      config: {
        sensitivity: 4, // Very high
      },
    }
    await this.#apiv1!.updateSensor(temperatureIdV1, temperatureSensor)
    await this.#apiv1!.updateSensor(lightIdV1, lightSensor)
    await this.#apiv1!.updateSensor(presenceIdV1, presenceSensor)
    await this.#updateDevice(idV2, device)
  }

  async configureAccessoryButton(
    type: AccessoryType,
    button: ButtonType,
    idV1: string,
    name: string,
    groupIdV1: string,
    daySceneIdV1: string,
    nightSceneIdV1: string,
  ) {
    Logger.info(
      `Configuring ${type} '${idV1}', button '${button}' to control group '${groupIdV1}'. Day scene: '${daySceneIdV1}', night scene: '${nightSceneIdV1}'.`,
    )
    let on = false
    let off = false
    let change = false
    let brighten = false
    let darken = false
    let onEvent, offEvent, brightenEvent, darkenEvent
    switch (type) {
      case AccessoryType.DimmerSwitch:
        brighten = button === ButtonType.Button2
        darken = button === ButtonType.Button3
        on = off = !brighten && !darken
        onEvent = offEvent = brightenEvent = darkenEvent = `${button}000` // initial_press
        break
      case AccessoryType.WallSwitch:
        on = off = true
        onEvent = offEvent = `${button}000` // initial_press
        break
      case AccessoryType.TapDialSwitch:
        change = off = true
        onEvent = `${button}002` // short_release
        offEvent = `${button}010` // long_press
        break
      default:
        throw new Error(`Unsupported accessory type: '${type}'`)
    }
    if (brighten) {
      const brightenRule = {
        name: `${name} lum. +`,
        conditions: [
          {
            address: `/sensors/${idV1}/state/buttonevent`,
            operator: 'eq',
            value: brightenEvent,
          },
          {
            address: `/sensors/${idV1}/state/lastupdated`,
            operator: 'dx',
          },
        ],
        actions: [
          {
            address: `/groups/${groupIdV1}/action`,
            method: 'PUT',
            body: {
              transitiontime: 10,
              bri_inc: 51,
            },
          },
        ],
      }
      await this.#createRule(brightenRule)
    }

    if (darken) {
      const darkenRule = {
        name: `${name} lum. -`,
        conditions: [
          {
            address: `/sensors/${idV1}/state/buttonevent`,
            operator: 'eq',
            value: darkenEvent,
          },
          {
            address: `/sensors/${idV1}/state/lastupdated`,
            operator: 'dx',
          },
        ],
        actions: [
          {
            address: `/groups/${groupIdV1}/action`,
            method: 'PUT',
            body: {
              transitiontime: 10,
              bri_inc: -51,
            },
          },
        ],
      }
      await this.#createRule(darkenRule)
    }

    if (on) {
      const daylightSensorId = Object.keys(
        await this.#getSensors(['Daylight']),
      )[0]
      const switchOnBaseRule: NewRule = {
        name: `${name} #${button} on`,
        conditions: [
          {
            address: `/sensors/${idV1}/state/buttonevent`,
            operator: 'eq',
            value: onEvent,
          },
          {
            address: `/sensors/${idV1}/state/lastupdated`,
            operator: 'dx',
          },
          {
            address: `/groups/${groupIdV1}/state/any_on`,
            operator: 'eq',
            value: 'false',
          },
          {
            address: `/sensors/${daylightSensorId}/state/daylight`,
            operator: 'eq',
            value: '{placeholder}',
          },
        ],
        actions: [
          {
            address: `/groups/${groupIdV1}/action`,
            method: 'PUT',
            body: {
              scene: '{placeholder}',
            },
          },
        ],
      }
      await this.#createRule(this.#toDayRule(switchOnBaseRule, daySceneIdV1))
      await this.#createRule(
        this.#toNightRule(switchOnBaseRule, nightSceneIdV1),
      )
    }

    if (off) {
      const switchOffRule = {
        name: `${name} #${button} off`,
        conditions: [
          {
            address: `/sensors/${idV1}/state/buttonevent`,
            operator: 'eq',
            value: offEvent,
          },
          {
            address: `/sensors/${idV1}/state/lastupdated`,
            operator: 'dx',
          },
          {
            address: `/groups/${groupIdV1}/state/any_on`,
            operator: 'eq',
            value: 'true',
          },
        ],
        actions: [
          {
            address: `/groups/${groupIdV1}/action`,
            method: 'PUT',
            body: {
              on: false,
            },
          },
        ],
      }
      await this.#createRule(switchOffRule)
    }

    if (change) {
      const daylightSensorId = Object.keys(
        await this.#getSensors(['Daylight']),
      )[0]
      const changeBaseRule: NewRule = {
        name: `${name} #${button}`,
        conditions: [
          {
            address: `/sensors/${idV1}/state/buttonevent`,
            operator: 'eq',
            value: onEvent,
          },
          {
            address: `/sensors/${idV1}/state/lastupdated`,
            operator: 'dx',
          },
          {
            address: `/sensors/${daylightSensorId}/state/daylight`,
            operator: 'eq',
            value: '{placeholder}',
          },
        ],
        actions: [
          {
            address: `/groups/${groupIdV1}/action`,
            method: 'PUT',
            body: {
              scene: '{placeholder}',
            },
          },
        ],
      }
      await this.#createRule(this.#toDayRule(changeBaseRule, daySceneIdV1))
      await this.#createRule(this.#toNightRule(changeBaseRule, nightSceneIdV1))
    }
  }

  async configureTapDial(
    idV2: string,
    groupIdV2: string,
    daySceneIdV2: string,
    groupType: string,
  ) {
    Logger.info(
      `Configuring dial '${idV2}' to control group '${groupIdV2}', scene: '${daySceneIdV2}'`,
    )
    const button = {
      on_short_release: {
        action: 'do_nothing',
      },
      on_long_press: {
        action: 'do_nothing',
      },
      where: [
        {
          group: {
            rid: groupIdV2,
            rtype: groupType,
          },
        },
      ],
    }
    const behavior = {
      type: 'behavior_instance',
      enabled: true,
      script_id: 'f306f634-acdb-4dd6-bdf5-48dd626d667e', // "Tap Switch script"
      configuration: {
        device: {
          rid: idV2,
          rtype: 'device',
        },
        button1: button,
        button2: button,
        button3: button,
        button4: button,
        rotary: {
          on_dim_off: {
            action: 'all_off',
          },
          on_dim_on: {
            recall_single: [
              {
                action: {
                  recall: {
                    rid: daySceneIdV2,
                    rtype: 'scene',
                  },
                },
              },
            ],
          },
          where: [
            {
              group: {
                rid: groupIdV2,
                rtype: groupType,
              },
            },
          ],
        },
      },
    }
    await this.#apiv2!.createBehaviorInstance(behavior)
  }

  async configureMotionSensor(
    macAddress: string,
    lightIdV1: string,
    presenceIdV1: string,
    name: string,
    groupIdV1: string,
    daySceneIdV1: string,
    nightSceneIdV1: string,
  ) {
    Logger.info(
      `Configuring motion sensor with IDs '${lightIdV1}', '${presenceIdV1}' to control group '${groupIdV1}'. Day scene: '${daySceneIdV1}', night scene: '${nightSceneIdV1}'.`,
    )

    // Create a virtual switch for the motion sensor
    const virtualSwitchSensor = {
      state: {
        flag: true, // Enabled
      },
      config: {
        on: true,
        reachable: true,
      },
      name: `${name} helper`,
      type: 'CLIPGenericFlag',
      modelid: 'PHILIPSHUEAUTOCONFIG',
      manufacturername: 'philips-hue-auto-config',
      swversion: '1.0',
      uniqueid: `${macAddress}-switch`,
      recycle: false,
    }
    const virtualSwitchSensorId = (
      await this.#apiv1!.createSensor(virtualSwitchSensor)
    ).at(0)!.success.id
    const virtualSwitchOffAction = {
      address: `/sensors/${virtualSwitchSensorId}/state`,
      method: 'PUT',
      body: {
        flag: false,
      },
    }
    const virtualSwitchOnAction = {
      address: `/sensors/${virtualSwitchSensorId}/state`,
      method: 'PUT',
      body: {
        flag: true,
      },
    }
    const virtualSwitchOnCondition = {
      address: `/sensors/${virtualSwitchSensorId}/state/flag`,
      operator: 'eq',
      value: 'true',
    }
    const virtualSwitchOffCondition = {
      address: `/sensors/${virtualSwitchSensorId}/state/flag`,
      operator: 'eq',
      value: 'false',
    }

    // Update accessory rules to disable the motion sensor when group is switched on (manual intervention)
    const rules = await this.#apiv1!.getRules()
    for (const ruleId of Object.keys(rules)) {
      const rule = rules[ruleId]
      const isGroupRule = _.some(
        rule.actions,
        (action) => action.address === `/groups/${groupIdV1}/action`,
      )
      if (!isGroupRule) {
        continue
      }
      const isSwitchOffGroupRule = _.some(
        rule.actions,
        (action) =>
          action.address === `/groups/${groupIdV1}/action` &&
          action.body.on !== undefined &&
          !action.body.on,
      )
      if (isSwitchOffGroupRule) {
        continue
      }
      rule.owner = undefined
      rule.recycle = undefined
      rule.created = undefined
      rule.lasttriggered = undefined
      rule.timestriggered = undefined
      rule.actions = _.concat<Action>([virtualSwitchOffAction], rule.actions)
      await this.#updateRule(ruleId, rule)
    }

    // On motion, recall a group scene (day or night scene)
    const daylightSensorId = Object.keys(
      await this.#getSensors(['Daylight']),
    )[0]
    const onMotionBaseRule: NewRule = {
      name: `${name} on`,
      conditions: [
        virtualSwitchOnCondition,
        {
          address: `/sensors/${presenceIdV1}/state/presence`,
          operator: 'eq',
          value: 'true',
        },
        {
          address: `/sensors/${presenceIdV1}/state/presence`,
          operator: 'dx',
        },
        {
          address: `/sensors/${lightIdV1}/state/dark`,
          operator: 'eq',
          value: 'true',
        },
        {
          address: `/sensors/${daylightSensorId}/state/daylight`,
          operator: 'eq',
          value: '{placeholder}',
        },
      ],
      actions: [
        {
          address: `/groups/${groupIdV1}/action`,
          method: 'PUT',
          body: {
            scene: '{placeholder}',
          },
        },
      ],
    }
    await this.#createRule(this.#toDayRule(onMotionBaseRule, daySceneIdV1))
    await this.#createRule(this.#toNightRule(onMotionBaseRule, nightSceneIdV1))

    // When no motion, transition to group off
    const noMotionRule = {
      name: `${name} off`,
      conditions: [
        virtualSwitchOnCondition,
        {
          address: `/sensors/${presenceIdV1}/state/presence`,
          operator: 'eq',
          value: 'false',
        },
        {
          address: `/sensors/${presenceIdV1}/state/presence`,
          operator: 'ddx',
          value: 'PT00:00:15', // After ~30s
        },
      ],
      actions: [
        {
          address: `/groups/${groupIdV1}/action`,
          method: 'PUT',
          body: {
            on: false,
          },
        },
      ],
    }
    await this.#createRule(noMotionRule)

    // When group switched on (manual intervention), disable the motion sensor
    const disableSensorRule = {
      name: `${name} disab.`,
      conditions: [
        virtualSwitchOnCondition,
        {
          address: `/groups/${groupIdV1}/state/any_on`,
          operator: 'eq',
          value: 'true',
        },
        {
          address: `/groups/${groupIdV1}/state/any_on`,
          operator: 'dx',
        },
        {
          address: `/sensors/${presenceIdV1}/state/presence`,
          operator: 'eq',
          value: 'false', // Not because of the sensor
        },
      ],
      actions: [virtualSwitchOffAction],
    }
    await this.#createRule(disableSensorRule)

    // After group switched off, enable the motion sensor again
    const enableSensorRule = {
      name: `${name} enab.`,
      conditions: [
        virtualSwitchOffCondition,
        {
          address: `/groups/${groupIdV1}/state/any_on`,
          operator: 'eq',
          value: 'false',
        },
        {
          address: `/groups/${groupIdV1}/state/any_on`,
          operator: 'dx',
        },
      ],
      actions: [virtualSwitchOnAction],
    }
    await this.#createRule(enableSensorRule)
  }

  #toNightRule(baseRule: NewRule, nightSceneIdV1: string) {
    const nightRule = _.cloneDeep(baseRule)
    _.find(nightRule.conditions, (condition) =>
      condition.address.includes('daylight'),
    )!.value = 'false'
    _.find(nightRule.actions, (action) =>
      action.address.includes('/action'),
    )!.body.scene = nightSceneIdV1
    return nightRule
  }

  #toDayRule(baseRule: NewRule, daySceneIdV1: string) {
    const dayRule = _.cloneDeep(baseRule)
    _.find(dayRule.conditions, (condition) =>
      condition.address.includes('daylight'),
    )!.value = 'true'
    _.find(dayRule.actions, (action) =>
      action.address.includes('/action'),
    )!.body.scene = daySceneIdV1
    return dayRule
  }

  #findSensorIdByAddressAndType(
    sensorsV1: SensorsV1,
    macAddress: string,
    type: string,
  ) {
    return _.find(Object.keys(sensorsV1), (key) => {
      const value = sensorsV1[key]
      const uniqueId = value.uniqueid
      return (
        uniqueId != null &&
        uniqueId.startsWith(macAddress) &&
        sensorsV1[key].type === type
      )
    })
  }

  async #hasMissingLights(lightIdList: LightIdentifiers[]) {
    return _.some(await this.#findMissingLights(lightIdList))
  }

  async #findMissingLights(
    lightIdList: LightIdentifiers[],
  ): Promise<LightIdentifiers[]> {
    const addedMacAddresses = Object.values(await this.#apiv1!.getLights()).map(
      (light) => light.uniqueid,
    )
    const missingLightIds = _.cloneDeep(lightIdList)
    _.remove(missingLightIds, (lightId) =>
      _.includes(addedMacAddresses, lightId.mac),
    )
    Logger.info('Missing lights:')
    Logger.table(missingLightIds)
    return missingLightIds
  }

  async #searchAccessories(accessoryIdList: AccessoryIdentifiers[]) {
    for (const accessoryId of accessoryIdList) {
      const name = accessoryId.name
      await this.#triggerSensorSearch(name, accessoryId.type)
      Logger.info(`Searching for '${name}'`)
      while (!(await this.#hasSensor(accessoryId.mac))) {
        if (!(await this.#isScanningSensors())) {
          await this.#triggerSensorSearch(name, accessoryId.type)
        }
        Logger.info(Color.DarkBlue, 'Scan is in progress ...')
        await this.#wait(10000)
      }
    }
  }

  async #triggerSensorSearch(name: string, type: AccessoryType) {
    const instuctionMsg =
      'Instructions/troubleshooting: https://github.com/jaaufauvre/philips-hue-auto-config?tab=readme-ov-file#troubleshooting'
    await this.#apiv1!.searchSensors()
    switch (type) {
      case AccessoryType.WallSwitch:
        Logger.info(
          Color.Purple,
          `[Wall switch] Now, toggle (on/off) each button of '${name}' one time. ${instuctionMsg}`,
        )
        break
      case AccessoryType.TapDialSwitch:
        Logger.info(
          Color.Purple,
          `[Tap dial switch] Now, press and hold the first button of '${name}' for 3 seconds. ${instuctionMsg}`,
        )
        break
      case AccessoryType.DimmerSwitch:
        Logger.info(
          Color.Purple,
          `[Dimmer switch] Now, press and hold the "on/off" button of '${name}' for 3 seconds. ${instuctionMsg}`,
        )
        break
      case AccessoryType.MotionSensor:
        Logger.info(
          Color.Purple,
          `[Motion sensor] Now, press the "setup" button of '${name}'. ${instuctionMsg}`,
        )
        break
      default:
        throw new Error(`Unsupported accessory type: '${type}'`)
    }
  }

  async #isScanningSensors(): Promise<boolean> {
    return (await this.#apiv1!.getNewSensors()).lastscan === 'active'
  }

  async #isWallSwitchUpdating(idV2: string): Promise<boolean> {
    return (
      (await this.#apiv2!.getDevice(idV2)).data[0].device_mode?.status !== 'set'
    )
  }

  async #isWallSwitchUpdated(
    idV2: string,
    mode: string,
    name: string,
  ): Promise<boolean> {
    const device = (await this.#apiv2!.getDevice(idV2)).data[0]
    return device.device_mode?.mode === mode && device.metadata.name === name
  }

  async #isScanningLights(): Promise<boolean> {
    return (await this.#apiv1!.getNewLights()).lastscan === 'active'
  }

  async #hasRoom(name: string): Promise<boolean> {
    const rooms = await this.#apiv2!.getRooms()
    return _.some(rooms.data, (room) => room.metadata?.name === name)
  }

  async #hasZone(name: string): Promise<boolean> {
    const zones = await this.#apiv2!.getZones()
    return _.some(zones.data, (room) => room.metadata?.name === name)
  }

  async #hasLight(mac: string): Promise<boolean> {
    const lights = await this.#apiv1!.getLights()
    return _.some(Object.values(lights), (light) => light.uniqueid === mac)
  }

  async #hasSensor(mac: string): Promise<boolean> {
    const sensors = await this.#apiv1!.getSensors()
    return _.some(Object.values(sensors), (sensor) =>
      sensor.uniqueid?.startsWith(mac),
    )
  }

  async #getSensors(types?: string[]) {
    const sensors = await this.#apiv1!.getSensors()
    for (const sensorId of Object.keys(sensors)) {
      if (types && !_.includes(types, sensors[sensorId].type)) {
        delete sensors[sensorId]
      }
    }
    return sensors
  }

  async #getDevices(productNames?: string[]) {
    const devices = await this.#apiv2!.getDevices()
    if (devices.errors.length > 0) {
      throw Error(
        `Couldn't retrieve devices. Errors: ${JSON.stringify(devices.errors, null, 2)}`,
      )
    }
    if (productNames) {
      _.remove(
        devices.data,
        (device) => !_.includes(productNames, device.product_data.product_name),
      )
    }
    return devices
  }

  async #createRule(rule: NewRule) {
    const rules = await this.#apiv1!.createRule(rule)
    if (_.find(rules, (r) => r.error != null)) {
      throw Error(
        `Couldn't create rule. Errors: ${JSON.stringify(rules, null, 2)}`,
      )
    }
  }

  async #updateRule(id: string, rule: RuleV1) {
    const rules = await this.#apiv1!.updateRule(id, rule)
    if (_.find(rules, (r) => r.error != null)) {
      throw Error(
        `Couldn't update rule '${id}'. Errors: ${JSON.stringify(rules, null, 2)}`,
      )
    }
  }

  async #updateDevice(id: string, device: UpdatedDevice) {
    const updatedDevice = await this.#apiv2!.updateDevice(id, device)
    if (updatedDevice.errors && updatedDevice.errors.length > 0) {
      throw Error(
        `Couldn't update device '${id}'. Errors: ${JSON.stringify(updatedDevice.errors, null, 2)}`,
      )
    }
  }

  #isBridge(device: Device) {
    return _.some(device.services, (resource) => resource.rtype === 'bridge')
  }

  #wait(ms: number) {
    Logger.debug(`Waiting for ${ms} ms...`)
    return new Promise((res) => setTimeout(res, ms))
  }
}

type Identifiers = {
  mac: string
  name: string
}

export type LightIdentifiers = Identifiers & {
  serial?: string
  id_v1?: string
  id_v2?: string
  ownerId?: string
}

export type AccessoryIdentifiers = Identifiers & {
  type: AccessoryType
  id_v1?: string
  id_v2?: string
}

export type WallSwitchIdentifiers = Identifiers & {
  id_v1?: string
  id_v2?: string
}

export type DimmerSwitchIdentifiers = Identifiers & {
  id_v1?: string
  id_v2?: string
}

export type TapDialSwitchIdentifiers = Identifiers & {
  type: AccessoryType
  dial_id_v1?: string
  switch_id_v1?: string
  id_v2?: string
}

export type MotionSensorIdentifiers = Identifiers & {
  type: AccessoryType
  presence_id_v1?: string
  light_id_v1?: string
  temperature_id_v1?: string
  id_v2?: string
}

export enum ButtonType {
  Button1 = 1,
  Button2 = 2,
  Button3 = 3,
  Button4 = 4,
}

export enum AccessoryType {
  WallSwitch = 'Wall switch',
  TapDialSwitch = 'Tap dial switch',
  DimmerSwitch = 'Dimmer switch',
  MotionSensor = 'Motion sensor',
}
