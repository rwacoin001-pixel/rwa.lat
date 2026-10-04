// Only public provider data is shared. This cache never contains accounts or orders.
const cache = new Map<string, { text: string; expires: number }>()
const pending = new Map<string, Promise<string>>()
const MAX_BYTES = 32 * 1024 * 1024
let active = 0
const waiting: Array<() => void> = []

async function acquire(signal?:AbortSignal|null) {
  if(signal?.aborted)throw new Error('Public data aborted')
  if(active<2){active++;return}
  if(waiting.length>=12)throw new Error('Public data busy')
  await new Promise<void>((resolve,reject)=>{
    const enter=()=>{signal?.removeEventListener('abort',cancel);resolve()}
    const cancel=()=>{const index=waiting.indexOf(enter);if(index>=0)waiting.splice(index,1);reject(new Error('Public data aborted'))}
    waiting.push(enter);signal?.addEventListener('abort',cancel,{once:true})
  })
}
function release(){const enter=waiting.shift();if(enter)enter();else active--}

type PublicOptions = RequestInit & { next?: { revalidate: number } }
export function publicIntegration() {
  return {marketDataReady:true,relayerConfigured:false,signerAddress:null,builderAddress:null,tradingEnabled:false}
}

export async function publicFetch(input: string, options: PublicOptions = {}): Promise<Response> {
  const url = new URL(input)
  if (!['https://gamma-api.polymarket.com','https://clob.polymarket.com'].includes(url.origin)) throw new Error('Unsupported provider')
  const ttl = options.cache === 'no-store' ? 0 : Math.min(options.next?.revalidate ?? 10, 30) * 1000
  const key = url.href
  const hit = cache.get(key)
  if (ttl && hit && hit.expires > Date.now()) return new Response(hit.text, {headers:{'content-type':'application/json'}})
  if (hit) cache.delete(key)
  // A fresh quote must never join or replay a cached quote request.
  const joined = ttl ? pending.get(key) : null
  if (joined) return new Response(await joined,{headers:{'content-type':'application/json'}})
  const work = (async () => {
    await acquire(options.signal)
    try {
    const {next: _next, ...init} = options
    const response = await fetch(url.href, {...init,redirect:'error',signal:options.signal??AbortSignal.timeout(8000)})
    if (!response.ok) { await response.body?.cancel(); throw new Error('Provider unavailable') }
    if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('Provider response too large') }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Empty provider response')
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      for (;;) {
        const {value,done} = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > MAX_BYTES) { await reader.cancel(); throw new Error('Provider response too large') }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(length)
    let position = 0
    for (const chunk of chunks) { bytes.set(chunk,position); position += chunk.length }
    const text = new TextDecoder().decode(bytes)
    // Large event payloads are reduced by the caller, never retained in memory.
    if (ttl && length <= 256 * 1024) {
      if (cache.size >= 40) cache.delete(cache.keys().next().value!)
      cache.set(key,{text,expires:Date.now()+ttl})
    }
    return text
    } finally {release()}
  })()
  if (ttl) pending.set(key,work)
  try { return new Response(await work,{headers:{'content-type':'application/json'}}) }
  finally { if (pending.get(key) === work) pending.delete(key) }
}
