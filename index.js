import pako from 'pako'
import delay from 'delay'
import { BrowserProvider } from './browser-provider'
import { LotusRPC } from '@filecoin-shipyard/lotus-client-rpc'
import { mainnet } from '@filecoin-shipyard/lotus-client-schema'
import { WasmProvider } from './wasm-provider'

async function download (url, defaultLength, status) {
  // https://dev.to/samthor/progress-indicator-with-fetch-1loo
  const response = await fetch(url)
  let length = response.headers.get('Content-Length')
  if (!length) {
    length = defaultLength
    // something was wrong with response, just give up
    // return await response.arrayBuffer()
  }
  const array = new Uint8Array(length)
  let at = 0 // to index into the array
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    status.textContent = `Fetching WASM bundle... ${at} of ${length} bytes`
    array.set(value, at)
    at += value.length
  }
  return array
}

document.addEventListener('DOMContentLoaded', async () => {
  // UI elements
  const status = document.getElementById('status')
  const output = document.getElementById('output')

  output.textContent = ''

  function log (txt) {
    console.info(txt)
    output.textContent += `${txt.trim()}\n`
  }

  // status.innerText = 'Loading Go WASM bundle...'

  // Use gzip: https://dstoiko.github.io/posts/go-pong-wasm/

  const go = new Go()
  const url = 'go-wasm/main.wasm.gz' // the gzip-compressed wasm file

  const compressed = await download(url, 7707428, status)
  status.textContent = `Uncompressing WASM... (compressed size: ${compressed.byteLength} bytes)`
  await delay(100)
  const wasm = pako.ungzip(compressed)
  const size = +wasm.buffer.byteLength

  status.textContent = `Instantiating WASM... (uncompressed size: ${size} bytes)`
  const result = await WebAssembly.instantiate(wasm, go.importObject)
  go.run(result.instance)
  await delay(1000)
  status.innerText = 'All systems good! JS and Go loaded.'

  const schema = {
    methods: {
      HelloName: {}
    }
  }

  /*
  console.log('Jim window.connectHelloService', window.connectHelloService)
  const wasmHelloServiceProvider = new WasmProvider(window.connectHelloService)
  const helloClient = new LotusRPC(wasmHelloServiceProvider, { schema })
  const goHelloButton = document.querySelector('#goHelloBtn')
  goHelloButton.disabled = false
  goHelloButton.onclick = async function () {
    log(`Go Hello`)
    const result = await helloClient.helloName('Jim')
    log(`Go Hello: ${JSON.stringify(result)}`)
  }
  */

  const wsUrl = 'wss://lotus.jimpick.com/spacerace_api/0/node/rpc/v0'
  const browserProvider = new BrowserProvider(wsUrl)
  await browserProvider.connect()
  const requestsForLotusHandler = async (req, responseHandler) => {
    const request = JSON.parse(req)
    console.log('JSON-RPC request => Lotus', request)
    async function waitForResult () {
      const result = await browserProvider.sendWs(request)
      console.log('Jim result', result)
      responseHandler(JSON.stringify(result))
    }
    waitForResult()
    // return 'abcde'
  }

  const wasmQueryAskServiceProvider = new WasmProvider(
    window.connectQueryAskService,
    {
      environment: {
        requestsForLotusHandler
      }
    }
  )

  const queryAskClient = new LotusRPC(wasmQueryAskServiceProvider, {
    schema: mainnet.fullNode
  })

  queryAskBtn.disabled = false
  queryAskBtn.onclick = async function () {
    log(`Query Ask WSS`)
    const result = await queryAskClient.clientQueryAsk(
      '12D3KooWEUS7VnaRrHF24GTWVGYtcEsmr3jsnNLcsEwPU7rDgjf5',
      'f063655'
    )
    log(`Query Ask WSS: ${JSON.stringify(result, null, 2)}`)
  }

  queryAskTcpBtn.disabled = false
  queryAskTcpBtn.onclick = async function () {
    log(`Query Ask TCP`)
    const result = await queryAskClient.clientQueryAsk(
      '12D3KooWDMpcct12Vb6jPXwjvLQHA2hoP8XKGbUZ2tpue1ydoZUm',
      'f02620'
    )
    log(`Query Ask TCP: ${JSON.stringify(result, null, 2)}`)
  }
})
