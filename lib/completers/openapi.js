const SwaggerParser = require('swagger-parser')

const OPENAPI_SPEC_PATHS = ['openapi.json', 'openapi/v1', 'openapi/v2']

const postfixWith = postfix => str => str + postfix
const prefixWith = prefix => str => prefix + str

class OpenAPIPlugin {
  constructor ({ specEndpoints }) {
    this.spec = undefined
    this.specEndpoints = specEndpoints ? [specEndpoints].flat() : OPENAPI_SPEC_PATHS
    this.paths = []
    this.methods = []
    this.pathsByMethod = {}
  }

  async onstart (httpConsole) {
    let spec
    const swaggerParser = new SwaggerParser()

    this.httpConsole = httpConsole
    // Perform OpenAPI autodiscovery.
    for (const path of this.specEndpoints) {
      try {
        const res = await this.httpConsole.got(path, { responseType: 'json' })
        if (res.statusCode === 200)
          spec = res.body
      }
      catch (e) {
        httpConsole.output.write(`Warning: error fetching OpenAPI spec: ${e.message}\n`)
      }
    }

    if (spec) {
      try {
        this.spec = await swaggerParser.dereference(spec)

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
      catch (e) {
        httpConsole.output.write(`Error parsing OpenAPI spec: ${e.message}\n`)
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
