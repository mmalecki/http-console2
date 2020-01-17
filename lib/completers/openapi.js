const JSONParser = require('stream-json/Parser')
const SwaggerParser = require('swagger-parser')

const OPENAPI_SPEC_PATHS = ['openapi.json', 'openapi/v1', 'openapi/v2']

const postfixWith = postfix => str => str + postfix
const prefixWith = prefix => str => prefix + str

const arrayStartsWith = (a, b) => {
  return b.every((v, idx) => v === a[idx])
}

class OpenAPIPlugin {
  constructor ({ specEndpoints }) {
    this.spec = undefined
    this.specEndpoints = specEndpoints ? [specEndpoints].flat() : OPENAPI_SPEC_PATHS
    this.paths = []
    this.methods = []
    this.pathsByMethod = {}
    this.paths = []
    this.schemaByPathMethod = {}
    this.schemaPropertiesByPathMethod = {}
    this.methods = []
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
      this.spec = await swaggerParser.dereference(spec)

      this.paths = Object.keys(this.spec.paths)

      for (const [path, methods] of Object.entries(this.spec.paths)) {
        for (const method of Object.keys(methods)) {
          if (!this.pathsByMethod[method]) this.pathsByMethod[method] = []
          this.pathsByMethod[method].push(path)

          const operation = methods[method]
          const content = operation.requestBody && operation.requestBody.content
          const schema = content && content['application/json'] && content['application/json'].schema

          if (schema) {
            if (!this.schemaByPathMethod[path]) this.schemaByPathMethod[path] = {}
            this.schemaByPathMethod[path][method] = schema

            if (!this.schemaPropertiesByPathMethod[path])
              this.schemaPropertiesByPathMethod[path] = {}

            const objectifyProperties = (schema) => {
              if (schema.type === 'object') {
                let ret = {}
                Object.entries(schema.properties || {}).forEach(([prop, propSchema]) => {
                  ret[prop] = objectifyProperties(propSchema)
                })
                return ret
              }
              else return { type: schema.type }
            }

            this.schemaPropertiesByPathMethod[path][method] = objectifyProperties(schema)
          }
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

  completeBody (cmd, partial, callback) {
    const { method, url } = cmd
    const parser = new JSONParser()

    const properties = this.schemaPropertiesByPathMethod[url] &&
      this.schemaPropertiesByPathMethod[url][method]

    if (!properties) return callback(null, [])

    const onparsed = () => {
      if (readingKey) {
        let prop = properties

        for (const key of currentStack.flat().filter(Boolean)) {
          prop = prop[key]
        }

        if (!prop) return callback(null, [])

        const partialKey = readingKey.join('')
        const proposals = Object.keys(prop)
          // The `typeof prop[key] !== 'string'` eliminates the final `{ "type": "string" }`
          // from showing up.
          .filter(key => key.startsWith(partialKey) && typeof prop[key] !== 'string')

        return callback(null,
          proposals
            .map(prefixWith(partial.slice(0, -partialKey.length)))
            .map(postfixWith('": '))
            .map((proposal, idx) => {
              const descriptor = prop[proposals[idx]]
              if (descriptor.type === 'string') return proposal + '"'
              if (typeof descriptor === 'object') return proposal + '{'
              return proposal
            })
        )
      }
    }

    let currentStack = []
    let readingKey = false

    parser.on('data', (data) => {
      if (readingKey) {
        if (data.name === 'stringChunk') readingKey.push(data.value)
        else if (data.name === 'endKey') {
          currentStack.push(readingKey.join(''))
          readingKey = false
        }
      }

      if (data.name === 'startKey') {
        readingKey = []
        currentStack.pop()
      }
      else if (data.name === 'startObject') currentStack.push([])
      else if (data.name === 'endObject') currentStack.pop()
    })

    parser.on('error', onparsed)
    parser.on('end', onparsed)

    parser.end(partial)
    // We can't `end` here, because we're dealing with partial JSON and the parser
    // will throw an error. It seems cleaner to use the 

    callback(null, [])
  }
}

module.exports = OpenAPIPlugin
