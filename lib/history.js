const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')

class History {
  constructor (basePath) {
    this.basePath = basePath
  }

  path (name) {
    return path.join(this.basePath, name.replace(/[:\/\\]/g, '-'))
  }

  read (name) {
    const history = fs.readFileSync(this.path(name), 'utf8')
    return history.split('\n')
      .map(JSON.parse)
      .reduce((acc, entry) => {
        if (!acc[entry.type]) acc[entry.type] = []
        acc[entry.type].push(entry)
        return acc
      }, {})
  }

  write (name, histories) {
    mkdirp.sync(this.basePath)

    const flat = Object.entries(histories).reduce((acc, [type, history]) =>
      [...acc, ...history.map(entry => ({ type, ...entry }))],
    []).sort((a, b) => b.ts - a.ts)

    fs.writeFileSync(this.path(name), flat.map(JSON.stringify).join('\n'), 'utf8')
  }
}

module.exports = History
