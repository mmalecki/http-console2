const prefixWith = prefix => str => prefix + str

class HistoryCompleter {
  constructor () {}

  async onstart (httpConsole) {
    this.httpConsole = httpConsole
  }

  completeCommand (partial, callback) {
    const pathsByMethod = this.httpConsole.commandHistory
      .map(cmd => cmd.split(' '))
      .reduce((acc, [method, url]) => {
        acc[method] = [...(acc[method] || []), url];
        return acc
      }, {})

    const [method, url] = partial.split(' ').map(s => s.trim())
    // I feel like autocompleting methods here might not add any value.
    if (typeof url !== 'string') return callback(null, [])

    const hits = new Set((pathsByMethod[method] || [])
      .filter(path => path.startsWith(url.toLowerCase())))
    callback(null, [...hits].map(prefixWith(method + ' ')))
  }
}

module.exports = HistoryCompleter
