'use strict'

const util = require('util')
const http = require('http')
const repl = require('repl')
const got = require('got')
const normalizeUrl = require('normalize-url')
const stylize = require('./ext/index.js')

// If you're sending GETs with a request body, we kindly suggest you to take your
// HTTP REPLing business somewhere else ;)
const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH'])

class AwaitingBodyError extends Error {}

class HTTPConsole {
  constructor (options) {
    this.baseUrl = normalizeUrl(options.baseUrl)
    this.headers = {}
    this.got = got.extend({
      prefixUrl: this.baseUrl,
      throwHttpErrors: false
    })
    this.json = options.json === true
    this.verbose = options.verbose === true

    this.input = options.input || process.stdin
    this.output = options.output || process.stdout

    this.colors = typeof options.colors === 'boolean' ? options.colors : this.output.isTTY

    // TODO: load those from files
    this.bodyHistory = []
    this.commandHistory = []

    // It might be wise to keep completers to one item, since they're additive.
    // For example, combining the OpenAPI completer with the basic autocompleter
    // will result in a fuck all of method autocompletion. Dunno.
    this.completers = options.completers || []

    this._waitingForBody = false
  }

  start () {
    this.repl = repl.start({
      prompt: `${this.baseUrl}> `,
      eval: this.eval.bind(this),
      input: this.input,
      output: this.output,
      useColors: this.colors,
      completer: this.completer.bind(this),
      writer: (data) => util.inspect(data, {
        depth: null,
        colors: this.colors
      })
    })

    this.completers.forEach(completer => completer.onstart && completer.onstart(this))

    this.repl.on('SIGINT', () => {
      this._waitForBody(false)
    })
  }

  completer (partial, cb) {
    let completions = [], finished = 0

    const addCompletions = (err, newCompletions) => {
      if (!err) completions.push(...newCompletions)
      if (++finished === this.completers.length) cb(null, [completions, partial])
    }

    // Node seems to just *exit* when we don't return from this callback. Doing
    // *something* would be reasonable, but just dropping dead? Possible core bug.
    if (this.completers.length === 0) return cb(null, [[], partial])

    for (const completer of this.completers) {
      if (this._waitingForBody) completer.completeBody(partial, addCompletions)
      else completer.completeCommand(partial, addCompletions)
    }
  }

  evalWithBody(cmd, cb) {
    // We need to handle the following cases here for JSON:
    //   * incomplete body read, continue reading until JSON termination
    //   * complete body read, send out
    //   * empty body - first line's empty

    const body = cmd.split('\n').slice(1).join('\n')

    let options = this._waitingForBody

    if (this.json && body) {
      try {
        options.json = JSON.parse(body)
      }
      catch (e) {
        if (e.name === 'SyntaxError' && e.message.match(/Unexpected end of JSON input/))
          return cb(new repl.Recoverable(e))
        else throw e
      }
    }
    else options.body = body

    this.bodyHistory.push(body)

    this._waitForBody(false)
    return this.req(options, cb)
  }

  eval (cmd, _a, _b, cb) {
    cmd = cmd.trim()

    if (this._waitingForBody)
      return this.evalWithBody(cmd, cb)

    if (cmd === '') return cb()

    this.commandHistory.push(cmd)

    const [method, url] = cmd.split(' ').map(s => s.trim())

    let options = { url: url || '/', method, headers: this.headers }

    if (METHODS_WITH_BODY.has(method.toUpperCase())) {
      this._waitForBody(options)
      return cb(new repl.Recoverable(new AwaitingBodyError()))
    }

    this.req(options, cb)
  }

  renderHeaders (res) {
    const stylizeStatusLine = statusLine => {
      let style = 'green'

      // got follows redirects, so we don't need to worry about them.
      if (res.statusCode >= 500) style = 'red'
      else if (res.statusCode >= 400) style = 'yellow'

      return this._stylize(this._stylize(statusLine, 'bold'), style)
    }

    const status = res.statusCode
    this.output.write(stylizeStatusLine(
      `HTTP/${res.httpVersion} ${status} ${http.STATUS_CODES[status]}\n`
    ))

    for (let [name, val] of Object.entries(res.headers))
      this.output.write(`${this._stylize(name, 'bold')}: ${val}\n`)
    this.output.write('\n')
  }

  _stylize (str, style) {
    return this.colors ? stylize(str, style) : str
  }

  _waitForBody (options) {
    // Modify the history so that only request bodies are in it if we're
    // switching to body mode, and vice versa.
    this._waitingForBody = options
    this.repl.history = options ? this.bodyHistory : this.commandHistory
  }

  async req (options, cb) {
    const url = options.url
    delete options.url

    if (this.json) options.responseType = 'json'

    // We're using a prefixed got, so trim the first slash if we have it.
    const resp = await this.got(url[0] === '/' ? url.slice(1) : url, options)
    this.renderHeaders(resp)
    cb(null, resp.body)
  }
}

module.exports = HTTPConsole
