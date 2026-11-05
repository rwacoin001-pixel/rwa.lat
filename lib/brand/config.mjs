const freeze = value => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child)
  return Object.freeze(value)
}
const brands = freeze({
  areit: {
    id: 'areit', name: 'A-REIT', chineseName: 'A-REIT', origin: 'https://a-reit.com',
    hosts: ['a-reit.com', 'www.a-reit.com'], assets: '/brand/a-reit',
    icon192: '/icons/a-reit-v1-192.png', icon512: '/icons/a-reit-v1-512.png',
    appleIcon: '/icons/a-reit-v1-apple-180.png', maskableIcon: '/icons/a-reit-v1-maskable-512.png',
    desktopRedirect: 'https://www.capitaland-ascendasreit.com/', noindex: false,
  },
  kimeng: {
    id: 'kimeng', name: 'KIMENG', chineseName: '金英', origin: 'https://kimengresearch.com',
    hosts: ['kimengresearch.com', 'www.kimengresearch.com'], assets: '/brand/kimeng',
    icon192: '/brand/kimeng/app-icon-192.png', icon512: '/brand/kimeng/app-icon-512.png',
    appleIcon: '/brand/kimeng/app-icon-180.png', maskableIcon: '/brand/kimeng/app-icon-maskable-512.png',
    desktopRedirect: null, noindex: true,
  },
})
export function resolveBrand(value) {
  const id = value === undefined ? 'areit' : value
  if (!Object.hasOwn(brands, id)) throw new Error(`Unknown site brand: ${String(id)}`)
  return brands[id]
}
export function canonicalBrandUrl(brand, input) {
  const url = new URL(input)
  if (url.protocol !== 'https:' || url.port || !brand.hosts.includes(url.hostname)) throw new Error('Host is not allowed for this brand')
  if (url.origin === brand.origin) return null
  return `${brand.origin}${url.pathname}${url.search}`
}
// Authored interface copy only: never API data, user content or historical documents.
export function brandUiCopy(text, brand, locale) {
  return brand.id === 'areit' ? text : text.replaceAll('A-REIT', locale?.startsWith('zh') ? brand.chineseName : brand.name)
}
export function buildManifest(brand) {
  return {
    name: `${brand.name} — AI Investment OS`, short_name: brand.name,
    description: 'One USDT wallet. Global opportunities. AI-guided decisions.',
    start_url: '/home', id: '/', scope: '/', display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'], orientation: 'portrait',
    background_color: '#F5F6F8', theme_color: '#F5F6F8', categories: ['finance', 'productivity'],
    shortcuts: [['Home', '/home'], ['Markets', '/markets'], ['Assets', '/assets']].map(([name, url]) => ({
      name, short_name: name, url, icons: [{ src: brand.icon192, sizes: '192x192' }],
    })),
    icons: [
      { src: brand.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: brand.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: brand.maskableIcon, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${brand.assets}/app-icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
