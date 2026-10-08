// Same-origin delivery for public Polymarket images. Shared by the Next route and the frontend Worker.
// Standard endpoint first (verified to serve the same bucket); regional is the fallback.
const UPSTREAM_HOSTS = ['polymarket-upload.s3.amazonaws.com', 'polymarket-upload.s3.us-east-2.amazonaws.com']
export const PREDICTION_MEDIA_PATH = '/media/prediction'
const MAX_BYTES = 2 * 1024 * 1024
const MAX_KEY = 1500
const MAX_QUERY = 512
const MAX_URL = 2400
// Hard cap for all connection attempts plus the body read.
const TIMEOUT_MS = 60000
const EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)$/i
const MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const CONTROL = /[\u0000-\u001f\u007f]/
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800'

type Options = {cache?: Cache; waitUntil?: (task: Promise<unknown>) => void; fetcher?: typeof fetch}
type Target = {key: string; query: string}

/** True for query names that indicate AWS v2/v4 signing. */
export function isSignedQueryName(name: string) {
  const lower = name.toLowerCase()
  return lower.startsWith('x-amz-') || lower === 'awsaccesskeyid' || lower === 'signature' || lower === 'expires'
}

function fail(status: number, message: string) {
  return new Response(message, {status, headers: {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}})
}

function parseTarget(url: URL): Target | null {
  if (url.href.length > MAX_URL) return null
  const names = [...url.searchParams.keys()]
  if (names.some(name => name !== 'key' && name !== 'q')) return null
  const keys = url.searchParams.getAll('key'), queries = url.searchParams.getAll('q')
  if (keys.length !== 1 || queries.length > 1) return null
  // `key` stays in its original encoded form; decoding below is only for validation.
  const key = keys[0], query = queries[0] ?? ''
  if (key.length > MAX_KEY || !key.startsWith('/') || key.startsWith('//') || /[?#\\]/.test(key) || CONTROL.test(key)) return null
  let decoded: string
  try { decoded = decodeURIComponent(key) } catch { return null }
  if (/\\/.test(decoded) || CONTROL.test(decoded)) return null
  if (decoded.split('/').some(segment => segment === '.' || segment === '..')) return null
  if (!EXTENSIONS.test(decoded)) return null
  if (query) {
    if (query.length > MAX_QUERY || /[#\\]/.test(query) || CONTROL.test(query) || query.startsWith('?')) return null
    if ([...new URLSearchParams(query).keys()].some(isSignedQueryName)) return null
  }
  return {key, query}
}

function canonicalUrl(origin: string, target: Target) {
  const params = new URLSearchParams({key: target.key})
  if (target.query) params.set('q', target.query)
  return `${origin}${PREDICTION_MEDIA_PATH}?${params}`
}

function imageResponse(body: ArrayBuffer, type: string, cache: 'HIT' | 'MISS') {
  return new Response(body, {status: 200, headers: {
    'content-type': type,
    'content-length': String(body.byteLength),
    'cache-control': CACHE_CONTROL,
    'x-content-type-options': 'nosniff',
    'x-rwa-image-cache': cache,
  }})
}

const FIRST_HEADERS_MS = 10000

/**
 * Rejects as soon as `signal` aborts, even if `task` ignores the signal. The listener is removed on
 * abort (once) or when the task settles; a value that arrives after abort is handed to `dispose`.
 */
function raceAbort<T>(task: Promise<T>, signal: AbortSignal, dispose?: (late: T) => void): Promise<T> {
  let abandoned = signal.aborted
  task.then(value => { if (abandoned) dispose?.(value) }, () => {})
  if (abandoned) return Promise.reject(new Error('aborted'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => { abandoned = true; reject(new Error('aborted')) }
    signal.addEventListener('abort', onAbort, {once: true})
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

const discard = (response: Response) => { response.body?.cancel().catch(() => {}) }

type Read = {body: ArrayBuffer} | {error: 'too-large' | 'empty'}

async function readLimited(response: Response, signal: AbortSignal): Promise<Read> {
  const declared = response.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) { await response.body?.cancel().catch(() => {}); return {error: 'too-large'} }
  if (!response.body) return {error: 'empty'}
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0, finished = false
  try {
    for (;;) {
      const {done, value} = await raceAbort(reader.read(), signal)
      if (done) { finished = true; break }
      total += value.byteLength
      if (total > MAX_BYTES) return {error: 'too-large'}
      chunks.push(value)
    }
  } finally {
    // Any early exit (oversize, abort, stream error) cancels the stream; always release the lock.
    if (!finished) reader.cancel().catch(() => {})
    try { reader.releaseLock() } catch { /* pending read on some runtimes */ }
  }
  if (total === 0) return {error: 'empty'}
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength }
  return {body: out.buffer}
}

type Fetched = {body: ArrayBuffer; type: string} | {status: number; message: string}

async function fetchUpstream(target: Target, fetcher: typeof fetch): Promise<Fetched> {
  // Global budget covers every connection attempt plus the body read.
  const global = new AbortController()
  let current: AbortController | null = null
  const onGlobalAbort = () => current?.abort()
  global.signal.addEventListener('abort', onGlobalAbort, {once: true})
  const globalTimer = setTimeout(() => global.abort(), TIMEOUT_MS)
  try {
    let response: Response | null = null, type = ''
    let failure: Fetched = {status: 502, message: 'Upstream unavailable'}
    for (let i = 0; i < UPSTREAM_HOSTS.length && !response; i++) {
      if (global.signal.aborted) break
      const connection = new AbortController()
      current = connection
      // Only the first host gets a headers deadline (10s, tolerates concurrent cold handshakes)
      // so the fallback still has the remaining global budget.
      const headersTimer = i === 0 && UPSTREAM_HOSTS.length > 1 ? setTimeout(() => connection.abort(), FIRST_HEADERS_MS) : null
      // Fixed host + raw key string; never resolve the key against a base URL.
      const upstream = `https://${UPSTREAM_HOSTS[i]}${target.key}${target.query ? `?${target.query}` : ''}`
      try {
        const candidate = await raceAbort(fetcher(upstream, {method: 'GET', headers: {accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif'}, credentials: 'omit', redirect: 'manual', signal: connection.signal}), connection.signal, discard)
        const candidateType = (candidate.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
        if (candidate.status !== 200) {
          // Redirects are never followed; any non-200 falls through to the next fixed host.
          discard(candidate)
          failure = {status: candidate.status === 404 || candidate.status === 403 ? 404 : 502, message: 'Image unavailable'}
        } else if (!MIME.has(candidateType)) {
          discard(candidate)
          failure = {status: 502, message: 'Unsupported image type'}
        } else {
          response = candidate
          type = candidateType
        }
      } catch {
        connection.abort()
        failure = {status: 502, message: 'Upstream unavailable'}
      } finally {
        if (headersTimer) clearTimeout(headersTimer)
      }
    }
    if (!response) return global.signal.aborted ? {status: 504, message: 'Upstream unavailable'} : failure
    const signal = current!.signal
    const read = await readLimited(response, signal)
    if ('error' in read) return {status: 502, message: read.error === 'empty' ? 'Empty image' : 'Image too large'}
    return {body: read.body, type}
  } catch {
    current?.abort()
    return {status: global.signal.aborted ? 504 : 502, message: 'Upstream unavailable'}
  } finally {
    clearTimeout(globalTimer)
    global.signal.removeEventListener('abort', onGlobalAbort)
  }
}

export async function proxyPredictionImage(request: Request, options: Options = {}): Promise<Response> {
  if (request.method !== 'GET') return fail(405, 'Method not allowed')
  const url = new URL(request.url)
  const target = parseTarget(url)
  if (!target) return fail(400, 'Invalid image key')
  const cacheKey = new Request(canonicalUrl(url.origin, target), {method: 'GET'})
  const {cache} = options
  if (cache) {
    try {
      const hit = await cache.match(cacheKey)
      if (hit && hit.status === 200) {
        const type = hit.headers.get('content-type') ?? ''
        if (MIME.has(type) && hit.body) {
          // Stream the cached body through; only whitelisted headers are copied, never private ones.
          const headers: Record<string, string> = {'content-type': type, 'cache-control': CACHE_CONTROL, 'x-content-type-options': 'nosniff', 'x-rwa-image-cache': 'HIT'}
          const length = hit.headers.get('content-length')
          if (length && /^\d+$/.test(length)) headers['content-length'] = length
          return new Response(hit.body, {status: 200, headers})
        }
        hit.body?.cancel().catch(() => {})
      }
    } catch { /* cache unavailable: fall through to upstream */ }
  }
  const result = await fetchUpstream(target, options.fetcher ?? fetch)
  if ('status' in result) return fail(result.status, result.message)
  if (cache) {
    const write = cache.put(cacheKey, imageResponse(result.body, result.type, 'MISS')).catch(() => {})
    if (options.waitUntil) options.waitUntil(write)
    else await write
  }
  return imageResponse(result.body, result.type, 'MISS')
}
