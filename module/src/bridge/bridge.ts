import { Logger, Color } from '../log/logger'
import crypto from 'crypto'
import type from 'typia'
import { Discovery } from '../api/discovery'
import _ from 'lodash'
import { ApiV1, CreateUserSuccess } from '../api/api-v1'
import { ApiV2, ResourceType } from '../api/api-v2'

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

  async createRoom(name: string, archetype?: string) {
    if (await this.hasRoom(name)) {
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
    Logger.info(
      Color.Green,
      `Room '${name}' was created with ID: '${created.data[0].rid}'`,
    )
  }

  async hasRoom(name: string): Promise<boolean> {
    const rooms = await this.#apiv2!.getRooms()
    return _.some(
      rooms.data,
      (r) => r.type === ResourceType.Room && r.metadata?.name === name,
    )
  }
}
