const baseUrl = process.env.RWA_DEMO_URL || 'http://localhost:3030'

const routes = [
  '/welcome',
  '/login',
  '/register',
  '/profile/kyc',
  '/home',
  '/invest',
  '/invest/rwa',
  '/invest/compute',
  '/invest/stocks',
  '/invest/prediction',
  '/portfolio',
  '/wallet',
  '/wallet/deposit',
  '/wallet/withdraw',
  '/wallet/transfer',
  '/wallet/confirmation',
  '/wallet/usdt',
  '/activity',
  '/portfolio/positions',
  '/ai',
  '/ai/plan',
  '/orders/review',
  '/orders/processing',
  '/orders/success',
  '/orders/partial',
  '/orders/failed',
  '/orders/receipt',
  '/notifications',
  '/profile/security',
  '/profile/referral',
  '/profile/records',
  '/profile/settings',
  '/profile/marketing',
  '/profile/support',
  '/security/official-channels',
  '/security/report-scam',
  '/profile/close-account',
  '/trust',
  '/trust/access-and-regions',
  '/trust/product-disclosures',
  '/trust/legal',
]

const failures = []

for (const route of routes) {
  try {
    const response = await fetch(`${baseUrl}${route}`)
    const html = await response.text()
    if (!response.ok || html.length < 500 || !html.includes('RWA.LAT')) {
      failures.push(`${route}: HTTP ${response.status}, incomplete application shell`)
    } else {
      console.log(`PASS ${route} (${response.status})`)
    }
  } catch (error) {
    failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

try {
  const response = await fetch(`${baseUrl}/api/polymarket/markets`)
  const payload = await response.json()
  if (!response.ok || !Array.isArray(payload.markets) || payload.markets.length === 0 || payload.integration?.tradingEnabled !== false) {
    failures.push('/api/polymarket/markets: invalid read-only market response')
  } else {
    console.log(`PASS /api/polymarket/markets (${payload.markets.length} public markets, trading disabled)`)
  }
} catch (error) {
  failures.push(`/api/polymarket/markets: ${error instanceof Error ? error.message : String(error)}`)
}

try {
  const response = await fetch(`${baseUrl}/route-not-in-demo`)
  const html = await response.text()
  if (!html.includes('ROUTE MONITOR') || !html.includes('Return to Home')) {
    failures.push('/route-not-in-demo: custom recovery page missing')
  } else {
    console.log('PASS custom unavailable-route recovery page')
  }
} catch (error) {
  failures.push(`/route-not-in-demo: ${error instanceof Error ? error.message : String(error)}`)
}

if (failures.length) {
  console.error('\nDemo verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`\nRWA.LAT Demo verification passed against ${baseUrl}`)
}
