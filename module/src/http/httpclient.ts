import axios from 'axios'
import { Logger } from '../log/logger'

class HttpClient {
  #httpsAgent
  #headers

  constructor(agent?: any, headers?: any) {
    this.#httpsAgent = agent
    this.#headers = headers
  }
  async get<T>(uri: string) {
    return await this.#handleError<Promise<T>>(() => this.#get<T>(uri))
  }

  async delete<T>(uri: string) {
    return await this.#handleError<Promise<T>>(() => this.#delete<T>(uri))
  }

  async post<T>(uri: string, body: any) {
    return await this.#handleError<Promise<T>>(() => this.#post<T>(uri, body))
  }

  async #get<T>(uri: string): Promise<T> {
    Logger.debug(`Sending GET request to ${uri} ...`)
    const response = await axios.get<T>(uri, {
      httpsAgent: this.#httpsAgent,
      headers: this.#headers,
    })
    const data = response.data
    Logger.debug('Response:', data)
    return data
  }

  async #delete<T>(uri: string): Promise<T> {
    Logger.debug(`Sending DELETE request to ${uri} ...`)
    const response = await axios.delete<T>(uri, {
      httpsAgent: this.#httpsAgent,
      headers: this.#headers,
    })
    const data = response.data
    Logger.debug('Response:', data)
    return data
  }

  async #post<T>(uri: string, body: any): Promise<T> {
    Logger.debug(`Sending POST request to ${uri} ...`)
    Logger.debug('Request:', body)
    const response = await axios.post<T>(uri, body, {
      httpsAgent: this.#httpsAgent,
      headers: this.#headers,
    })
    const data = response.data
    Logger.debug('Response:', data)
    return data
  }

  async #handleError<T>(action: () => T): Promise<T> {
    try {
      return await action()
    } catch (e: any) {
      if (axios.isAxiosError(e)) {
        Logger.debug('Error:', e.toJSON())
        throw Error(
          `An error occurred when sending HTTP request. Code: '${e.code}', message: '${e.message}'.`,
        )
      } else throw e
    }
  }
}

export { HttpClient }
