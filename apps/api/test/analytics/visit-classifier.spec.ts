import {
  authenticatedUserId, classifyDevice, clientCountry, countryCode, extractClientIp, isBotUserAgent, isPrivateIp, isTrackedRequest, normalizeIp,
  normalizeRoutePath, sourceHost, truncateUserAgent,
} from '../../src/analytics/visit-classifier'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const USER = '4f9c2a1e-8b7d-4c3a-9e2f-1a2b3c4d5e6f'

describe('API traffic: client IP extraction', () => {
  it('prefers CF-Connecting-IP over request.ip and X-Forwarded-For', () => {
    expect(extractClientIp({ ip: '203.0.113.9', headers: { 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.1' } })).toBe('198.51.100.7')
  })
  it('uses the trust-proxy resolved request.ip when there is no Cloudflare header', () => {
    expect(extractClientIp({ ip: '203.0.113.9', headers: { 'x-forwarded-for': '198.51.100.1' } })).toBe('203.0.113.9')
  })
  it('unwraps IPv4-mapped IPv6 and lower-cases IPv6', () => {
    expect(normalizeIp('::ffff:203.0.113.9')).toBe('203.0.113.9')
    expect(extractClientIp({ ip: '2001:DB8::1', headers: {} })).toBe('2001:db8::1')
  })
  it('falls back to the first X-Forwarded-For entry when request.ip is a proxy', () => {
    expect(extractClientIp({ ip: '::ffff:127.0.0.1', headers: { 'x-forwarded-for': ' 203.0.113.5 , 10.0.0.1' } })).toBe('203.0.113.5')
    expect(extractClientIp({ ip: '127.0.0.1', headers: { 'x-forwarded-for': ['203.0.113.6:5123'] } })).toBe('203.0.113.6')
  })
  it('ignores malformed headers and keeps the private address when nothing better exists', () => {
    expect(extractClientIp({ ip: '127.0.0.1', headers: { 'cf-connecting-ip': 'nope', 'x-forwarded-for': 'not-an-ip' } })).toBe('127.0.0.1')
    expect(extractClientIp({ ip: undefined, headers: { 'x-forwarded-for': "'; DROP TABLE" } })).toBeNull()
    expect(normalizeIp('999.1.1.1')).toBeNull()
  })
  it.each(['10.1.2.3', '127.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '169.254.1.1', '::1', 'fd00::1', 'fe80::1'])(
    'treats %s as private', (ip) => expect(isPrivateIp(ip)).toBe(true))
  it.each(['8.8.8.8', '172.32.0.1', '100.128.0.1', '2001:4860:4860::8888'])('treats %s as public', (ip) => expect(isPrivateIp(ip)).toBe(false))
})

describe('API traffic: device and bot classification', () => {
  it.each([
    [IPHONE, 'mobile'], [ANDROID_PHONE, 'mobile'], [ANDROID_TABLET, 'tablet'], [IPAD, 'tablet'], [WINDOWS, 'desktop'], [MAC, 'desktop'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'bot'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36', 'bot'],
    ['curl/8.4.0', 'bot'], ['python-requests/2.31', 'bot'], ['facebookexternalhit/1.1', 'bot'], ['node', 'bot'], ['', 'bot'],
    ['SomeCustomClient/1.0 (unknown platform)', 'other'],
  ])('%s -> %s', (ua, device) => expect(classifyDevice(ua)).toBe(device))
  it('flags missing user agents as bots', () => expect(isBotUserAgent(undefined)).toBe(true))
})

describe('API traffic: request filtering and field sanitising', () => {
  it.each([
    ['GET', '/v1/catalog/products', true], ['POST', '/v1/auth/login/password', true], ['OPTIONS', '/v1/catalog/products', false],
    ['HEAD', '/v1/catalog/products', false], ['GET', '/v1/health', false], ['GET', '/v1/health/ready', false], ['GET', '/v1/docs', false],
    ['GET', '/v1/admin/orders', false], ['GET', '/v1/analytics/x', false], ['POST', '/v1/job-queue/callbacks', false],
    ['POST', '/v1/compliance/kyc/webhooks/didit', false], ['GET', '/v1/media/email-v1/logo.png', false], ['GET', '/robots.txt', false],
  ])('%s %s tracked=%s', (method, path, tracked) => expect(isTrackedRequest(method as string, path as string)).toBe(tracked))

  it('drops the query, collapses ids and truncates to 200 chars', () => {
    expect(normalizeRoutePath('/v1/catalog/products?ref=abc#top')).toBe('/v1/catalog/products')
    expect(normalizeRoutePath(`/v1/orders/${USER}/receipt`)).toBe('/v1/orders/:id/receipt')
    expect(normalizeRoutePath('/v1/community/posts/123456')).toBe('/v1/community/posts/:id')
    expect(normalizeRoutePath('/v1/polymarket/markets/will-bitcoin-hit-100k')).toBe('/v1/polymarket/markets/will-bitcoin-hit-100k')
    expect(normalizeRoutePath(`/v1/${'a'.repeat(400)}`)).toHaveLength(200)
    expect(normalizeRoutePath('no-slash')).toBeNull()
  })
  it('takes the calling site host from Origin, then Referer', () => {
    expect(sourceHost('https://a-reit.com', 'https://other.example/x')).toBe('a-reit.com')
    expect(sourceHost(undefined, 'https://www.a-reit.com/market?x=1')).toBe('www.a-reit.com')
    expect(sourceHost('null', 'android-app://com.slack')).toBeNull()
    expect(sourceHost('not a url', undefined)).toBeNull()
  })
  it('accepts two-letter CF-IPCountry codes only', () => {
    expect(countryCode('cn')).toBe('CN')
    expect(countryCode('T1')).toBe('T1')
    expect(countryCode('USA')).toBeNull()
    expect(countryCode(undefined)).toBeNull()
  })
  it('truncates user agents and accepts only UUID user ids', () => {
    expect(truncateUserAgent('x'.repeat(500))).toHaveLength(300)
    expect(authenticatedUserId(USER.toUpperCase())).toBe(USER)
    expect(authenticatedUserId('admin')).toBeNull()
    expect(authenticatedUserId(undefined)).toBeNull()
  })
})

describe('API traffic: frontend Worker headers', () => {
  it('prefers the Worker-supplied client IP over Cloudflare and proxy addresses', () => {
    expect(extractClientIp({ ip: '172.18.0.4', headers: { 'x-client-ip': '203.0.113.7', 'cf-connecting-ip': '2a06:98c0:3600::103' } })).toBe('203.0.113.7')
  })

  it('ignores a malformed Worker IP and falls back to Cloudflare', () => {
    expect(extractClientIp({ ip: '172.18.0.4', headers: { 'x-client-ip': 'not-an-ip', 'cf-connecting-ip': '198.51.100.2' } })).toBe('198.51.100.2')
  })

  it('takes the visitor country from the Worker, then CF-IPCountry', () => {
    expect(clientCountry({ 'x-client-country': 'jp', 'cf-ipcountry': 'SG' })).toBe('JP')
    expect(clientCountry({ 'x-client-country': 'Japan', 'cf-ipcountry': 'SG' })).toBe('SG')
    expect(clientCountry({})).toBeNull()
  })
})
