import pako from 'pako'
import { BrowserProvider } from './browser-provider'
import { LotusRPC } from '@filecoin-shipyard/lotus-client-rpc'
import { mainnet } from '@filecoin-shipyard/lotus-client-schema'
import { WasmProvider } from './wasm-provider'

document.addEventListener('DOMContentLoaded', async () => {
  // UI elements
  const status = document.getElementById('status')
  const output = document.getElementById('output')

  output.textContent = ''

  function log (txt) {
    console.info(txt)
    output.textContent += `${txt.trim()}\n`
  }

  status.innerText = 'Loading Go WASM bundle...'

  // Use gzip: https://dstoiko.github.io/posts/go-pong-wasm/

  const go = new Go()
  const url = 'go-wasm/main.wasm.gz' // the gzip-compressed wasm file
  let wasm = pako.ungzip(await (await fetch(url)).arrayBuffer())
  // A fetched response might be decompressed twice on Firefox.
  // See https://bugzilla.mozilla.org/show_bug.cgi?id=610679
  if (wasm[0] === 0x1f && wasm[1] === 0x8b) {
    wasm = pako.ungzip(wasm)
  }
  const result = await WebAssembly.instantiate(wasm, go.importObject)
  go.run(result.instance)
  await new Promise(resolve => window.setTimeout(resolve, 1000))
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
