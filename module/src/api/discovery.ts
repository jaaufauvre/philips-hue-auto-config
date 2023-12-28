import { HttpClient } from '../http/httpclient'
import { Logger } from '../log/logger'

class Discovery {
  #httpsClient = new HttpClient()

  async discover() {
    Logger.info('Searching for bridges ...')
    const bridges = await this.#httpsClient.get<Bridge[]>(
      'https://discovery.meethue.com/',
    )
    return bridges
  }
}

interface Bridge {
  id: string
  internalipaddress: string
  port: number
}

export { Discovery, Bridge }
