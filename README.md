# http-console2

> Speak HTTP like a local

*http-console2* aims to be a user-friendly, REPL-based HTTP API explorer. In
addition to [sending basic requests](#making-requests), it supports:

* [OpenAPI-based autocompletion](#openapi-based-autocompletion)
* Multiline JSON bodies

# Installation
*http-console2* was written for [node](http://nodejs.org), so make sure you have that installed
first. Then you need [npm](http://github.com/isaacs/npm), node's package manager.

Once you're all set, run:

    $ npm install http-console2 -g

It'll download the dependencies, and install the command-line tool.

# Usage
Let's assume we have an HTTP API server running on port 8000.

## Connecting

To connect, we run `http-console`, passing it the server host and port as such:

    $ http-console 127.0.0.1:8000

Optionally, you can also specify the protocol:

    $ http-console https://127.0.0.1:8433

You can also enable JSON parsing and sending from the get-go:

    $ http-console --json https://127.0.0.1:8001

Once connected, you'll see the prompt:

    http://127.0.0.1:8000>

### Making requests

You can make HTTP requests by using their HTTP verb, for example:

    http://127.0.0.1:8000> get /
    HTTP/1.1 200 OK
    content-type: application/json
    date: Thu, 16 Jan 2020 04:18:16 GMT
    connection: close
    transfer-encoding: chunked

    { hello: 'world' }


    http://127.0.0.1:8000> get /foo
    HTTP/1.1 404 Not Found
    content-type: text/plain; charset=utf-8
    content-length: 9
    date: Thu, 16 Jan 2020 04:18:59 GMT
    connection: close

    'Not Found'

You can also send POST/PUT/PATCH/DELETE/etc. requests:

    http://127.0.0.1:8000> POST /rabbits
    ... {"name":"Roger"}

    HTTP/1.1 201 Created
    content-type: application/json
    content-length: 62
    date: Thu, 16 Jan 2020 04:55:22 GMT
    connection: close

    { uuid: '61568573-72c3-4cfe-8440-8777fd3a76fc', name: 'Roger' }

#### Multiline JSON bodies
Editing larger JSON object in a single line quickly turns into a nightmare. *
That's why *http-console* supports multiline JSON bodies:


    http://127.0.0.1:8000> post /pet-hotel
    ... {
    ...   "meta": {
    ..... "name": "Roger",
    ..... "kind": "Rabbit",
    ..... "breed": "Super Fluffy 1000"
    ..... }
    ... }

    HTTP/1.1 201 Created
    content-type: application/json
    content-length: 62
    date: Thu, 16 Jan 2020 04:55:22 GMT
    connection: close

    { uuid: '61568573-72c3-4cfe-8440-8777fd3a76fc' }

Ctrl + C will exit multiline JSON body mode and get you back to the prompt.

### Setting headers

Sometimes, it's useful to set HTTP headers:

    http://127.0.0.1:8000> Accept: application/json
    http://127.0.0.1:8000> X-Lodge: black

These headers are sent with all requests in this session. To see all active headers,
run the `.headers` command:

    http://127.0.0.1:8000> .headers
    Accept: application/json
    X-Lodge: black

Removing headers is just as easy:

    http://127.0.0.1:8000> Accept:
    http://127.0.0.1:8000> .headers
    X-Lodge: black

### OpenAPI-based autocompletion
If the API you're chatting with supports OpenAPI, *http-console2* can discover the
specification and offer autocompletion suggestions based on it.

To enable OpenAPI support, launch *http-console2* with the `--openapi` switch (and
`--json`, when appropriate):

    $ http-console --openapi --json 127.0.0.1:8001

*http-console2* will then try to autodiscover the API specification under the
following URLs:

  * `/openapi.json`
  * `/openapi/v1`
  * `/openapi/v2`

You can also explicitly set the specification endpoint:

    $ http-console --openapi /v1/openapi.json --json 127.0.0.1:8001

If the specification discovery succeeds, you'll be able to use autocompletion
when typing in the method and the URL:

    http://127.0.0.1:8001> get /apis/apps/v1/d<TAB>
    get /apis/apps/v1/daemonsets   get /apis/apps/v1/deployments

### Quitting

Ctrl + D to exit, as you would the usual Node REPL.
