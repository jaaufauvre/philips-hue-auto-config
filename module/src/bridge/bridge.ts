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
    for (const device of (await this.#apiv2!.getDevices()).data) {
      if (!this.#isBridge(device)) {
        await this.#apiv2!.deleteDevice(device.id)
      }
    }
  }

  async updateBridgeLocation(lat: string, long: string) {
    Logger.info('Updating bridge location ...')
    const daylightSensorId = Object.keys(await this.#getSensors('Daylight'))[0]
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
    return created.data[0].rid
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
    return created.data[0].rid
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

  async addLightToRoom(lightOwnerId: string, roomId: string) {
    Logger.info(`Adding light owned by '${lightOwnerId}' to room '${roomId}'`)
    const children = (await this.#apiv2!.getRoom(roomId)).data[0].children
    children.push({
      rid: lightOwnerId,
      rtype: 'device',
    })
    const room = {
      children: children,
    }
    await this.#apiv2!.updateRoom(roomId, room)
  }

  async addLightToZone(lightId: string, zoneId: string) {
    Logger.info(`Adding light '${lightId}' to zone '${zoneId}'`)
    const children = (await this.#apiv2!.getZone(zoneId)).data[0].children
    children.push({
      rid: lightId,
      rtype: 'light',
    })
    const zone = {
      children: children,
    }
    await this.#apiv2!.updateZone(zoneId, zone)
  }

  async updateLightMetadata(lightOwnerId: string, name: string, type?: string) {
    Logger.info(`Updating metadata for device '${lightOwnerId}'`)
    const device = {
      metadata: {
        name: name,
        archetype: type ?? 'unknown_archetype',
      },
    }
    await this.#apiv2!.updateDevice(lightOwnerId, device)
  }

  async updateLightPowerUp(id: string, preset: string) {
    Logger.info(`Updating power up behavior for light '${id}' to '${preset}'`)
    const light = {
      powerup: {
        preset: preset,
      },
    }
    await this.#apiv2!.updateLight(id, light)
  }

  async addScene(
    name: string,
    roomOrZoneId: string,
    roomOrZoneType: string,
    lightIds: string[],
    brightness: number,
    mirek: number,
    imageId: string,
  ): Promise<string> {
    Logger.info(`Adding scene '${name}' to ${roomOrZoneType} '${roomOrZoneId}'`)
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
        rid: roomOrZoneId,
        rtype: roomOrZoneType,
      },
      actions: actions,
    })
    return created.data[0].rid
  }

  async activateScene(id: string) {
    Logger.info(`Activating scene '${id}'`)
    await this.#apiv2!.updateScene(id, { recall: { action: 'active' } })
  }

  async addWallSwitches(
    wallSwitchIdList: WallSwitchIdentifiers[],
  ): Promise<WallSwitchIdentifiers[]> {
    Logger.info('Adding wall switches ...')
    for (const wallSwitchId of wallSwitchIdList) {
      const name = wallSwitchId.name
      this.#triggerWallSwitchSearch(name)
      Logger.info(`Searching for wall switch '${name}'`)
      while (!(await this.#hasSensor(wallSwitchId.mac))) {
        if (!(await this.#isScanningWallSwitches())) {
          this.#triggerWallSwitchSearch(name)
        }
        Logger.info(Color.DarkBlue, 'Scan is in progress ...')
        await this.#wait(10000)
      }
    }
    // All wall switches were added
    const macAddresses = wallSwitchIdList.map(
      (wallSwitchId) => wallSwitchId.mac,
    )
    const wallSwitchesV1 = await this.#getSensors('ZLLSwitch')
    for (const id of Object.keys(wallSwitchesV1)) {
      if (!_.includes(macAddresses, wallSwitchesV1[id].uniqueid)) {
        // A wall switch was added and was not listed in the config, we delete it from the bridge
        Logger.info(
          `Deleting wall switch '${id}' (not declared in the config) ...`,
        )
        await this.#apiv1!.deleteSensor(id)
      }
    }
    // Find wall switch resource IDs
    const devicesV2 = await this.#apiv2!.getDevices()
    const finalWallSwitchIdList = _.cloneDeep(wallSwitchIdList)
    _.forEach(finalWallSwitchIdList, (wallSwitchId) => {
      wallSwitchId.id_v1 = _.find(
        Object.keys(wallSwitchesV1),
        (key) => wallSwitchesV1[key].uniqueid === wallSwitchId.mac,
      )
      const wallSwitch = _.find(
        devicesV2.data,
        (device) => device.id_v1 === `/sensors/${wallSwitchId.id_v1}`,
      )
      wallSwitchId.id_v2 = wallSwitch!.id
    })
    return finalWallSwitchIdList
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

  async #isScanningLights(): Promise<boolean> {
    return (await this.#apiv1!.getNewLights()).lastscan === 'active'
  }

  async #triggerWallSwitchSearch(name: string) {
    await this.#apiv1!.searchSensors()
    Logger.info(
      Color.Purple,
      `Now, press or toggle wall switch '${name}' one time. Reset the device in case it doesn't show up after a few minutes.`,
    )
  }

  async #isScanningWallSwitches(): Promise<boolean> {
    return (await this.#apiv1!.getNewSensors()).lastscan === 'active'
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

  async #getSensors(type: string) {
    const sensors = await this.#apiv1!.getSensors()
    for (const sensorId of Object.keys(sensors)) {
      if (sensors[sensorId].type !== type) {
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

export type LightIdentifiers = {
  mac: string
  serial?: string
  id_v1?: string
  id_v2?: string
  ownerId?: string
}

export type WallSwitchIdentifiers = {
  mac: string
  name: string
  id_v1?: string
  id_v2?: string
}
