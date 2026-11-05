import { resolveBrand } from './config.mjs'
import { isPublicRead } from '../edge-public-cache.mjs'

export async function previewPasswordHash(password) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')
}
const responseHeaders = {
  'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow, nosnippet',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
}
export function securePreviewResponse(response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(responseHeaders)) headers.set(key, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
function holdingPage(status = 503, challenge = false) {
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>金英 KIMENG</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#f5f6f8;color:#121416;font:16px/1.7 system-ui,sans-serif}main{max-width:620px;padding:48px 28px;text-align:center}img{width:112px;height:112px}h1{font-size:30px;letter-spacing:.12em;margin:28px 0 12px}p{color:#5e656b}small{color:#6b7278}a{color:inherit;text-underline-offset:5px}</style><main><img src="/brand/kimeng/mark-light.svg" alt="金英虎标"><h1>KIMENG · 金英</h1><p>平台正在准备中</p><p>金英将与 A-REIT 共用账户和数据，两个网站分别登录。<br>账户与交易功能将在资料及安全验收完成后开放。</p><small>Preview in preparation</small>${status === 503 ? '<p><a href="/__preview">进入受保护的内测</a></p>' : '<p>请使用内测访问口令。</p>'}</main></html>`
  return new Response(html, { status, headers: { ...responseHeaders, 'content-type': 'text/html; charset=utf-8', ...(challenge ? { 'www-authenticate': 'Basic realm="KIMENG preview", charset="UTF-8"' } : {}), ...(status === 503 ? { 'retry-after': '3600' } : {}) } })
}
async function previewAuthorized(request, expectedHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash ?? '')) return false
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Basic ') || header.length > 512) return false
  try {
    const raw = atob(header.slice(6)), colon = raw.indexOf(':')
    if (colon < 0 || raw.slice(0, colon) !== 'kimeng') return false
    const actual = await previewPasswordHash(raw.slice(colon + 1))
    let difference = 0
    for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i)
    return difference === 0
  } catch { return false }
}

/** Fail closed until independent security, operator and authentication acceptance is complete. */
export async function brandRequestGate(request, env) {
  let brand
  try { brand = resolveBrand(env.SITE_BRAND) } catch { return { response: new Response('Invalid deployment', { status: 503 }) } }
  const url = new URL(request.url)
  // Preserve the original A-REIT deployment, including its existing non-custom-domain development flow.
  if (brand.id === 'areit') return { request, preview: false }
  if (!brand.hosts.includes(url.hostname) || url.port) return { response: new Response('Misdirected request', { status: 421, headers: responseHeaders }) }
  if (url.protocol !== 'https:' || url.origin !== brand.origin) return { response: Response.redirect(`${brand.origin}${url.pathname}${url.search}`, 308) }
  // The holding page uses these public identity assets; no app code or backend access is exposed here.
  if (['/brand/kimeng/mark-light.svg', '/brand/kimeng/mark-dark.svg', '/brand/kimeng/app-icon-192.png', '/brand/kimeng/favicon.ico'].includes(url.pathname) && ['GET','HEAD'].includes(request.method)) return { request, preview: true, asset: true }
  if (env.KIMENG_RELEASE_MODE !== 'preview' || !env.KIMENG_PREVIEW_PASSWORD_SHA256) return { response: holdingPage() }
  if (!await previewAuthorized(request, env.KIMENG_PREVIEW_PASSWORD_SHA256)) return { response: holdingPage(url.pathname === '/' ? 503 : 401, url.pathname !== '/') }
  if (url.pathname === '/__preview') return { response: Response.redirect(`${brand.origin}/home`, 303) }
  let decoded
  try { decoded = decodeURIComponent(url.pathname) } catch { return { response: new Response('Invalid path', { status: 400, headers: responseHeaders }) } }
  const route = decoded.toLowerCase()
  const authAsset = /^\/auth\/(?:auth-(?:warm|cool)-(?:still\.png|loop-h264\.mp4)|icon-(?:wallet|x|github)\.svg|icon-google-color\.png)$/.test(url.pathname)
  const restrictedPage = !authAsset && /^\/(?:api|auth|r|app-login|app-handoff)(?:\/|$)/.test(route)
  if (!['GET','HEAD'].includes(request.method) || restrictedPage || route === '/sw.js' ||
      (/^\/v1(?:\/|$)/.test(route) && (url.pathname !== decoded || decoded !== route || !(isPublicRead(request.method, decoded) || (request.method === 'GET' && decoded === '/v1/platform/brands/kimeng'))))) {
    return { response: Response.json({ code: 'KIMENG_PREVIEW_ONLY', message: '金英当前为界面内测，账户及资金功能尚未开放。' }, { status: 503, headers: responseHeaders }) }
  }
  const headers = new Headers(request.headers)
  // Basic preview credentials must never reach the application/API or request logs.
  headers.delete('authorization')
  headers.delete('cookie')
  return { request: new Request(request, { headers }), preview: true }
}
