import { Logger, Color } from '../log/logger'
import crypto from 'crypto'
import type from 'typia'
import { Discovery } from '../api/discovery'
import _ from 'lodash'
import { ApiV1, CreateUserSuccess } from '../api/api-v1'
import { ApiV2, Device } from '../api/api-v2'

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
    for (const light of (await this.#apiv2!.getLights()).data) {
      await this.#apiv2!.deleteDevice(light.owner.rid)
    }
    for (const room of (await this.#apiv2!.getRooms()).data) {
      await this.#apiv2!.deleteRoom(room.id)
    }
    for (const zone of (await this.#apiv2!.getZones()).data) {
      await this.#apiv2!.deleteZone(zone.id)
    }
    for (const ruleId of Object.keys(await this.#apiv1!.getRules())) {
      await this.#apiv1!.deleteRule(ruleId)
    }
    for (const device of (await this.#apiv2!.getDevices()).data) {
      if (!this.#isBridge(device)) {
        await this.#apiv2!.deleteDevice(device.id)
      }
    }
    for (const sensorId of Object.keys(await this.#apiv1!.getSensors())) {
      await this.#apiv1!.deleteSensor(sensorId)
    }
    for (const linkId of Object.keys(await this.#apiv1!.getResourcelinks())) {
      await this.#apiv1!.deleteResourcelink(linkId)
    }
    for (const sceneId of Object.keys(await this.#apiv1!.getScenes())) {
      await this.#apiv1!.deleteScene(sceneId)
    }
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
          break
        }
        // Search one by one by serial
        const serial = missingLightId.serial
        Logger.info(`Searching for serial ${serial}`)
        await this.#apiv1!.searchLights({ deviceid: [serial] })
        while (
          (await this.#isScanningLights()) &&
          !(await this.#hasLight(missingLightId.mac))
        ) {
          Logger.info(Color.DarkBlue, 'Scan with serial is in progress ...')
          await this.#wait(10000)
        }
      }
    }
    // All lights were found
    const macAddresses = lightIdList.map((lightId) => lightId.mac)
    const lightsV1 = await this.#apiv1!.getLights()
    for (const id of Object.keys(lightsV1)) {
      if (!_.includes(macAddresses, lightsV1[id].uniqueid)) {
        // A light was found and was not listed in the config, we delete it from the bridge
        Logger.info(`Deleting light '${id}' (not declared in the config) ...`)
        await this.#apiv1!.deleteLight(id)
      }
    }
    // Find light resource IDs
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
    Logger.info(`Updating metadata for device '${lightOwnerIdV2}'`)
    const device = {
      metadata: {
        name: name,
        archetype: type ?? 'unknown_archetype',
      },
    }
    await this.#apiv2!.updateDevice(lightOwnerIdV2, device)
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
    brightness: number,
    mirek: number,
    imageId: string,
  ) {
    Logger.info(`Adding scene '${name}' to ${groupType} '${groupIdV2}'`)
    const actions = _.map(lightIds, (id) => {
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
      actions: actions,
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

  async addWallSwitches(
    wallSwitchIdList: WallSwitchIdentifiers[],
  ): Promise<WallSwitchIdentifiers[]> {
    Logger.info('Adding wall switches ...')
    // All all wall switches
    await this.#addAccessories(wallSwitchIdList, AccessoryType.WallSwitch)
    // Find wall switch resource IDs
    const sensorsV1 = await this.#getSensors()
    const devicesV2 = await this.#apiv2!.getDevices()
    const finalIdList = _.cloneDeep(wallSwitchIdList)
    _.forEach(finalIdList, (wallSwitchId) => {
      wallSwitchId.id_v1 = _.find(Object.keys(sensorsV1), (key) => {
        const value = sensorsV1[key]
        const uniqueId = value.uniqueid
        return uniqueId != null && uniqueId === wallSwitchId.mac
      })
      const wallSwitch = _.find(
        devicesV2.data,
        (device) => device.id_v1 === `/sensors/${wallSwitchId.id_v1}`,
      )
      wallSwitchId.id_v2 = wallSwitch!.id
    })
    return finalIdList
  }

  async addTapDialSwitches(
    tapDialSwitchIdList: TapDialSwitchIdentifiers[],
  ): Promise<TapDialSwitchIdentifiers[]> {
    Logger.info('Adding tap dial switches ...')
    // All all tap dial switches
    await this.#addAccessories(tapDialSwitchIdList, AccessoryType.TapDialSwitch)
    // Find tap dial resource IDs
    const sensorsV1 = await this.#getSensors()
    const devicesV2 = await this.#apiv2!.getDevices()
    const finalIdList = _.cloneDeep(tapDialSwitchIdList)
    _.forEach(finalIdList, (tapDialSwitchId) => {
      tapDialSwitchId.switch_id_v1 = _.find(Object.keys(sensorsV1), (key) => {
        const value = sensorsV1[key]
        const uniqueId = value.uniqueid
        return (
          uniqueId != null &&
          uniqueId.startsWith(tapDialSwitchId.mac) &&
          sensorsV1[key].type === 'ZLLSwitch'
        )
      })
      tapDialSwitchId.dial_id_v1 = _.find(Object.keys(sensorsV1), (key) => {
        const value = sensorsV1[key]
        const uniqueId = value.uniqueid
        return (
          uniqueId != null &&
          uniqueId.startsWith(tapDialSwitchId.mac) &&
          value.type === 'ZLLRelativeRotary'
        )
      })
      const tapDialSwitch = _.find(
        devicesV2.data,
        (device) => device.id_v1 === `/sensors/${tapDialSwitchId.dial_id_v1}`,
      )
      tapDialSwitchId.id_v2 = tapDialSwitch!.id
    })
    return finalIdList
  }

  async updateWallSwitchProperties(idV2: string, name: string, mode: string) {
    Logger.info(`Updating wall switch '${idV2}', mode '${mode}'`)
    const device = {
      metadata: {
        name: name,
        archetype: 'unknown_archetype',
      },
      device_mode: {
        mode: mode,
      },
    }
    await this.#apiv2!.updateDevice(idV2, device)
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
    const sensor = {
      name: name,
    }
    await this.#apiv2!.updateDevice(idV2, device)
    await this.#apiv1!.updateSensor(dialIdV1, sensor)
    await this.#apiv1!.updateSensor(switchIdV1, sensor)
  }

  async configureAccessoryButton(
    type: AccessoryType,
    button: ButtonType,
    idV1: string,
    name: string,
    groupIdV1: string,
    sceneIdV1: string,
  ) {
    Logger.info(
      `Configuring accessory '${idV1}' to control group '${groupIdV1}', scene: '${sceneIdV1}', button: '${button}'`,
    )
    let onEvent, offEvent
    switch (type) {
      case AccessoryType.WallSwitch:
        onEvent = `${button}000` // initial_press
        offEvent = `${button}000` // initial_press
        break
      case AccessoryType.TapDialSwitch:
        onEvent = `${button}000` // initial_press
        offEvent = `${button}010` // long_press
        break
      default:
        throw new Error(`Unsupported accessory type: '${type}'`)
    }
    const switchOnRule = {
      name: `${name} #${button} ON`,
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
      ],
      actions: [
        {
          address: `/groups/${groupIdV1}/action`,
          method: 'PUT',
          body: {
            scene: `${sceneIdV1}`,
          },
        },
      ],
    }
    const switchOffRule = {
      name: `${name} #${button} OFF`,
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
    await this.#apiv1!.createRule(switchOnRule)
    await this.#apiv1!.createRule(switchOffRule)
  }

  async configureTapDial(
    idV2: string,
    groupIdV2: string,
    sceneIdV2: string,
    groupType: string,
  ) {
    Logger.info(
      `Configuring dial '${idV2}' to control group '${groupIdV2}', scene: '${sceneIdV2}'`,
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
                    rid: sceneIdV2,
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

  async #addAccessories(accessoryIdList: Identifiers[], type: AccessoryType) {
    for (const accessoryId of accessoryIdList) {
      const name = accessoryId.name
      this.#triggerSensorSearch(name, type)
      Logger.info(`Searching for '${name}'`)
      while (!(await this.#hasSensor(accessoryId.mac))) {
        if (!(await this.#isScanningSensors())) {
          this.#triggerSensorSearch(name, type)
        }
        Logger.info(Color.DarkBlue, 'Scan is in progress ...')
        await this.#wait(10000)
      }
    }
  }

  async #triggerSensorSearch(name: string, type: AccessoryType) {
    await this.#apiv1!.searchSensors()
    switch (type) {
      case AccessoryType.WallSwitch:
        Logger.info(
          Color.Purple,
          `Now, toggle (on/off) each button of wall switch '${name}' one time. Reset the device in case it doesn't show up after a few minutes.`,
        )
        break
      case AccessoryType.TapDialSwitch:
        Logger.info(
          Color.Purple,
          `Now, press button #1 of tap dial switch '${name}' for 3 seconds. Reset the device in case it doesn't show up after a few minutes.`,
        )
        break
      default:
        throw new Error(`Unsupported accessory type: '${type}'`)
    }
  }

  async #isScanningSensors(): Promise<boolean> {
    return (await this.#apiv1!.getNewSensors()).lastscan === 'active'
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
    return _.some(Object.values(sensors), (sensor) => sensor.uniqueid === mac)
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

export type WallSwitchIdentifiers = Identifiers & {
  id_v1?: string
  id_v2?: string
}

export type TapDialSwitchIdentifiers = Identifiers & {
  dial_id_v1?: string
  switch_id_v1?: string
  id_v2?: string
}

export enum ButtonType {
  Button1 = 1,
  Button2 = 2,
  Button3 = 3,
  Button4 = 4,
}

export enum AccessoryType {
  WallSwitch,
  TapDialSwitch,
}
