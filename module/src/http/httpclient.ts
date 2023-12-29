import axios, { AxiosError } from 'axios'
import { Logger } from '../log/logger'

class HttpClient {
  #httpsAgent
  #headers

  constructor(agent?: any, headers?: any) {
    this.#httpsAgent = agent
    this.#headers = headers
  }
  async get<T>(uri: string) {
    return await this.#handleError<Promise<T>>(() => this.#get(uri))
  }

  async post<T>(uri: string, body: any) {
    return await this.#handleError<Promise<T>>(() => this.#post(uri, body))
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
      if (e instanceof AxiosError) {
        if (e.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          Logger.debug('Response:', e.response.data)
          Logger.debug('Status code:', e.response.status)
          Logger.debug('Headers:', e.response.headers)
        } else if (e.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          Logger.debug('Request:', e.request)
        } else {
          // Something happened in setting up the request that triggered an Error
          Logger.debug('Message:', e.message)
        }
        Logger.debug(e.toJSON())
        throw Error(
          `An error occurred when sending HTTP request. Code: '${e.code}', message: '${e.message}'.`,
        )
      } else throw e
    }
  }
}

export { HttpClient }
