const OPENAPI_SPEC_PATHS = ['openapi.json', 'openapi/v1', 'openapi/v2']

const postfixWith = postfix => str => str + postfix
const prefixWith = prefix => str => prefix + str

class OpenAPIPlugin {
  constructor () {
    this.spec = undefined
    this.pathsByMethod = {}
  }

  async onstart (httpConsole) {
    this.httpConsole = httpConsole
    // Perform OpenAPI autodiscovery.
    for (const path of OPENAPI_SPEC_PATHS) {
      const res = await this.httpConsole.got(path, { responseType: 'json' })
      if (res.statusCode === 200)
        this.spec = res.body
    }

    if (this.spec) {
      this.methods = new Array(...new Set(
        Object.values(this.spec.paths)
          .map(path => Object.keys(path))
          .flat()
      ))

      this.paths = Object.keys(this.spec.paths)

      for (const [path, methods] of Object.entries(this.spec.paths)) {
        for (const method of Object.keys(methods)) {
          if (!this.pathsByMethod[method]) this.pathsByMethod[method] = []
          this.pathsByMethod[method].push(path)
        }
      }
    }
  }

  completeMethod (partial, callback) {
    const hits = this.methods.filter(method => method.startsWith(partial.toLowerCase()))
    callback(null, (hits.length ? hits : this.methods).map(postfixWith(' ')))
  }

  completeUrl (method, partial, callback) {
    const paths = this.pathsByMethod[method] || this.paths
    const hits = paths.filter(path => path.startsWith(partial.toLowerCase()))
    callback(null, hits)
  }

  completeCommand (partial, callback) {
    const [method, url] = partial.split(' ').map(s => s.trim())
    if (typeof url !== 'string') this.completeMethod(partial, callback)
    else {
      this.completeUrl(method, url, (err, urlCompletions) => {
        if (err) return callback(err)
        callback(null, urlCompletions.map(prefixWith(method + ' ')))
      })
    }
  }
}

module.exports = OpenAPIPlugin
