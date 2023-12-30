/**
 * A simple logger with timestamp and colors.
 * Set the DEBUG env variable to get "debug" logs.
 */
export enum Color {
  Default,
  Red,
  Green,
  Yellow,
  DarkBlue,
  Purple,
  LightBlue,
}

export class Logger {
  static #useDebug = false
  static #colorMap: Map<Color, string | undefined> = new Map([
    [Color.Red, '\x1b[31m%s\x1b[0m'],
    [Color.Green, '\x1b[32m%s\x1b[0m'],
    [Color.Yellow, '\x1b[33m%s\x1b[0m'],
    [Color.DarkBlue, '\x1b[34m%s\x1b[0m'],
    [Color.Purple, '\x1b[35m%s\x1b[0m'],
    [Color.LightBlue, '\x1b[36m%s\x1b[0m'],
  ])

  static #log = (...objects: any[]) => {
    let color = Color.Default
    if (objects.length > 0 && Object.values(Color).includes(objects[0])) {
      color = objects[0]
      objects.shift()
    }
    objects.unshift(new Date().toISOString())
    if (Color.Default === color) {
      console.log(...objects)
    } else {
      console.log(
        this.#colorMap.get(color)!.replace('%s', '%s '.repeat(objects.length)),
        ...objects,
      )
    }
  }

  static info = (...objects: any[]) => {
    this.#log(...objects)
  }

  static error = (...objects: any[]) => {
    objects.unshift('[Error]')
    this.#log(Color.Red, ...objects)
  }

  static debug = (...objects: any[]) => {
    if (process.env.DEBUG == 'true' || Logger.#useDebug) {
      objects.unshift('[Debug]')
      this.#log(...objects)
    }
  }

  static setDebug(useDebug: boolean) {
    this.#useDebug = useDebug
  }
}
