const baseUrl = process.env.RWA_DEMO_URL || 'http://localhost:3030'

const routes = [
  '/welcome',
  '/login',
  '/register',
  '/verify-email',
  '/recovery',
  '/auth/email/confirm',
  '/login/email/confirm',
  '/auth/verify',
  '/auth/recover/confirm',
  '/profile/kyc',
  '/home',
  '/invest',
  '/profile',
  '/invest/rwa',
  '/invest/compute',
  '/invest/stocks',
  '/invest/prediction',
  '/invest/valuation',
  '/invest/sample-asset/valuation',
  '/issuers',
  '/issuers/current',
  '/issuers/sample-issuer',
  '/search',
  '/portfolio',
  '/portfolio/yield-calendar',
  '/portfolio/rebalance',
  '/wallet',
  '/wallet/deposit',
  '/wallet/withdraw',
  '/wallet/transfer',
  '/wallet/confirmation',
  '/wallet/usdt',
  '/activity',
  '/portfolio/positions',
  '/statements',
  '/ai',
  '/ai/plan',
  '/orders/review',
  '/orders/processing',
  '/orders/success',
  '/orders/partial',
  '/orders/failed',
  '/orders/receipt',
  '/orders/detail',
  '/notifications',
  '/wallet/address-book',
  '/community',
  '/community/post',
  '/community/member',
  '/onboarding/overview',
  '/secondary',
  '/trade',
  '/fees-and-limits',
  '/profile/eligibility',
  '/profile/risk-profile',
  '/profile/security',
  '/profile/referral',
  '/profile/records',
  '/profile/settings',
  '/profile/marketing',
  '/profile/support',
  '/profile/support/new',
  '/profile/support/ticket',
  '/security/official-channels',
  '/security/report-scam',
  '/profile/close-account',
  '/trust',
  '/trust/access-and-regions',
  '/trust/product-disclosures',
  '/trust/legal',
  '/status',
  '/invest/disclosures',
]

const failures = []

for (const route of routes) {
  try {
    const response = await fetch(`${baseUrl}${route}`)
    const html = await response.text()
    if (!response.ok || html.length < 500 || !html.includes('A-REIT')) {
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
  console.log(`\nA-REIT Demo verification passed against ${baseUrl}`)
}
