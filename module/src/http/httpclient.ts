import axios, { AxiosError } from 'axios'
import { Logger } from '../log/logger'

class HttpClient {
  #httpsAgent
  constructor(agent?: any) {
    this.#httpsAgent = agent
  }
  async get<T>(uri: string) {
    return await this.#handleError<Promise<T>>(() => this.#get(uri))
  }

  async post<T>(uri: string, body: any) {
    return await this.#handleError<Promise<T>>(() => this.#post(uri, body))
  }

  async #get<T>(uri: string): Promise<T> {
    Logger.debug(`Sending GET request to ${uri} ...`)
    const response = await axios.get<T>(uri, { httpsAgent: this.#httpsAgent })
    const data = response.data
    Logger.debug(data)
    return data
  }

  async #post<T>(uri: string, body: any): Promise<T> {
    Logger.debug(`Sending POST request to ${uri} ...`)
    Logger.debug(body)
    const response = await axios.post<T>(uri, body, {
      httpsAgent: this.#httpsAgent,
    })
    const data = response.data
    Logger.debug(data)
    return data
  }

  async #handleError<T>(action: () => T): Promise<T> {
    try {
      return await action()
    } catch (e: any) {
      if (e instanceof AxiosError) {
        Logger.debug(e)
        throw Error(
          `An error occurred when sending HTTP request. Code: '${e.code}', message: '${e.message}'.`,
        )
      } else throw e
    }
  }
}

export { HttpClient }
