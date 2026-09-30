const apiBase = process.env.RWA_ACCOUNT_API_URL || 'http://localhost:4000'
const providedEmail = process.env.RWA_TEST_EMAIL
const email = providedEmail || `codex.qa.${Date.now()}@example.com`
const failures = []

async function call(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { accept: 'application/json', 'content-type': 'application/json', ...(options.headers || {}) },
  })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text.slice(0, 200) }
  return { status: response.status, body }
}

function check(label, result, expected = [200]) {
  if (!expected.includes(result.status)) {
    failures.push(`${label}: expected ${expected.join('|')}, got ${result.status}`)
  } else {
    console.log(`PASS ${label} (${result.status})`)
  }
}

if (providedEmail) {
  console.log(`PASS demo account registration (reuse ${email})`)
} else {
  const registration = await call('/v1/auth/demo/register', { method: 'POST', body: JSON.stringify({ email, locale: 'en' }) })
  check('demo account registration', registration, [201, 200, 409])
}
const login = await call('/v1/auth/demo/login', { method: 'POST', body: JSON.stringify({ email, type: 'user' }) })
check('demo account login', login, [201, 200])
const token = login.body?.token ?? login.body?.sessionToken ?? login.body?.accessToken
const sessionId = login.body?.sessionId
if (typeof token !== 'string') {
  failures.push('demo account login: response did not include a token')
} else {
  const headers = { authorization: `Bearer ${token}` }
  const auth = (path, options = {}) => call(path, { ...options, headers: { ...headers, ...(options.headers || {}) } })
  const getPaths = [
    '/v1/health', '/v1/health/ready', '/v1/capabilities', '/v1/summary', '/v1/wallet', '/v1/wallet/networks', '/v1/wallet/withdrawal-addresses',
    '/v1/ledger/balances', '/v1/ledger/transactions?limit=20', '/v1/portfolio/positions',
    '/v1/portfolio/history', '/v1/orders', '/v1/market/orders', '/v1/basket/portfolios',
    '/v1/basket/me/subscriptions', '/v1/basket/me/redemptions', '/v1/basket/disclosures',
    '/v1/notifications?filter=all', '/v1/user-ops/tickets', '/v1/user-ops/invitations',
    '/v1/user-ops/rewards', '/v1/user-ops/subscriptions', '/v1/user-ops/preferences',
    '/v1/security/sessions', '/v1/security/devices', '/v1/security/factors', '/v1/security/events',
    '/v1/compliance/kyc/status', '/v1/compliance/screening', '/v1/compliance/risk-profile/questionnaire',
    '/v1/compliance/risk-profile', '/v1/rwa/overview', '/v1/rwa/assets?featured=true&limit=8',
    '/v1/rwa/issuers', '/v1/rwa/networks', '/v1/rwa/categories', '/v1/rwa/rankings?metric=volume&limit=8',
    '/v1/market-context', '/v1/market/pairs', '/v1/polymarket/status', '/v1/polymarket/markets?state=active&limit=4',
    '/v1/predictions/status', '/v1/yield', '/v1/community/feed?limit=4', '/v1/community/topics', '/v1/ai/status',
  ]
  for (const path of getPaths) check(`GET ${path}`, await auth(path))

  const aiChat = await auth('/v1/ai/chat', { method: 'POST', body: JSON.stringify({ message: 'Explain tokenized real-world assets in one sentence.', locale: 'en' }) })
  check('AI chat', aiChat, [200, 201])
  const aiBody = aiChat.body?.data ?? aiChat.body
  if (aiBody?.messageId) check('AI feedback', await auth('/v1/ai/feedback', { method: 'POST', body: JSON.stringify({ messageId: aiBody.messageId, helpful: true }) }), [200, 201])
  check('AI sessions', await auth('/v1/ai/sessions'))
  check('basket recommendation', await auth('/v1/basket/recommendations', { method: 'POST', body: JSON.stringify({ horizon: 'medium', riskAppetite: 'balanced', focus: 'diversified', experience: 'new' }) }), [200, 201])
  check('risk profile submit', await auth('/v1/compliance/risk-profile', { method: 'POST', body: JSON.stringify({ answers: { experience: 3, horizon: 4, drawdown: 3, objective: 4, stability: 4, liquidity: 3 } }) }), [200, 201])
  check('eligibility evaluate', await auth('/v1/compliance/eligibility/evaluate', { method: 'POST', body: JSON.stringify({ productScope: 'default', region: 'US' }) }), [200, 201])
  check('sanctions screening', await auth('/v1/compliance/screening', { method: 'POST', body: JSON.stringify({ kind: 'sanctions', identifiers: {} }) }), [200, 201])
  check('preferences update', await auth('/v1/user-ops/preferences', { method: 'PUT', body: JSON.stringify({ locale: 'en', channels: { product: true, marketing: false }, communication_consent: true }) }), [200, 201])

  const ticket = await auth('/v1/user-ops/tickets', { method: 'POST', body: JSON.stringify({ subject: `Codex QA ${Date.now()}`, body: 'Automated account flow smoke test.', category: 'support', priority: 'low' }) })
  check('support ticket create', ticket, [200, 201])
  const ticketBody = ticket.body?.data ?? ticket.body
  const ticketId = ticketBody?.id
  if (ticketId) {
    check('support ticket timeline', await auth(`/v1/user-ops/tickets/${ticketId}/timeline`))
    check('support ticket message', await auth(`/v1/user-ops/tickets/${ticketId}/messages`, { method: 'POST', body: JSON.stringify({ body: 'Automated follow-up.' }) }), [200, 201])
    check('support ticket close', await auth(`/v1/user-ops/tickets/${ticketId}/close`, { method: 'PUT' }))
  } else failures.push('support ticket create: response did not include an id')

  const invitation = await auth('/v1/user-ops/invitations', { method: 'POST', body: JSON.stringify({ role: 'member' }) })
  check('invitation create', invitation, [200, 201])
  const invitationBody = invitation.body?.data ?? invitation.body
  const invitationId = invitationBody?.view?.id ?? invitationBody?.id
  if (invitationId) check('invitation revoke', await auth(`/v1/user-ops/invitations/${invitationId}/revoke`, { method: 'PUT' }))
  check('notifications read-all', await auth('/v1/notifications/read-all', { method: 'POST' }), [200, 201])
  check('deposit address', await auth('/v1/wallet/deposit-addresses/tron', { method: 'POST', body: '{}' }), [200, 201])
  check('withdrawal quote', await auth('/v1/wallet/withdrawals/quote', { method: 'POST', body: JSON.stringify({ network: 'tron', atomicAmount: '100000000' }) }), [200, 201])
  check('KYC provider gate', await auth('/v1/compliance/kyc/start', { method: 'POST', body: JSON.stringify({ provider: 'didit' }) }), [400])
  check('logout', await call('/v1/auth/logout', { method: 'POST', headers, body: JSON.stringify({ sessionId, token }) }), [200, 201])
}

if (failures.length) {
  console.error('\nAccount verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`\nRWA.LAT account verification passed for ${email} (token omitted)`)
}
