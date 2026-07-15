/*
 * Local-only functional acceptance for the documented Demo main path.
 * It deliberately creates a new account on every run and only talks to a
 * local Core API with DEMO_OPERATIONS_ENABLED=true.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const baseUrl = process.env.RWA_API_URL ?? 'http://127.0.0.1:4000/v1'
const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }),
)
const webhookSecret = env.WALLET_WEBHOOK_SECRET
if (!webhookSecret) throw new Error('WALLET_WEBHOOK_SECRET is required in apps/api/.env for the local Demo acceptance run.')

function canonicalJson(value) {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(payload)}`)
  return payload
}

const post = (path, body, headers) => request(path, { method: 'POST', headers, body: JSON.stringify(body) })
const put = (path, body, headers) => request(path, { method: 'PUT', headers, body: JSON.stringify(body) })
const authHeaders = (token) => ({ authorization: `Bearer ${token}` })
const idempotency = (prefix) => `${prefix}-${randomUUID()}`

const email = `acceptance-${Date.now()}-${randomBytes(4).toString('hex')}@demo.rwa.lat`
const registration = await post('/auth/demo/register', { email, locale: 'en' })
const login = await post('/auth/demo/login', { email, type: 'user' })
if (registration.userId !== login.userId) throw new Error('Re-login did not restore the registered user ID.')
const headers = authHeaders(login.token)

const kyc = await post('/compliance/kyc/start', { provider: 'stub' }, headers)
await post('/compliance/kyc/submit', { providerCaseRef: `acceptance-${randomUUID()}` }, headers)
await post(`/compliance/kyc/${kyc.id}/decision`, { decision: 'approved', reasonCode: 'demo_approved' })

const networks = await request('/wallet/networks')
const arbitrum = networks.networks.find((network) => network.id === 'arbitrum')
const depositAddress = await post('/wallet/deposit-addresses/arbitrum', {}, headers)
const depositPayload = {
  network: 'arbitrum',
  transactionHash: `0x${randomBytes(32).toString('hex')}`,
  destinationAddress: depositAddress.address,
  atomicAmount: '20000000000',
  confirmations: arbitrum.requiredConfirmations,
  outputIndex: 0,
  riskDecision: 'clear',
}
const eventId = `acceptance-deposit-${randomUUID()}`
const timestamp = String(Math.floor(Date.now() / 1000))
const signature = createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${eventId}.${canonicalJson(depositPayload)}`)
  .digest('hex')
const deposit = await post('/wallet/callbacks/custody/deposits', depositPayload, {
  'x-custody-event-id': eventId,
  'x-custody-timestamp': timestamp,
  'x-custody-signature': `sha256=${signature}`,
})
if (deposit.deposit.state !== 'credited') throw new Error(`Deposit did not credit: ${deposit.deposit.state}`)

const products = await request('/catalog/products')
const byClass = Object.fromEntries(products.map((product) => [product.assetClassId, product]))
async function createAndFill(assetClassId, amount, outcomeKey, explicitProduct) {
  const product = explicitProduct ?? byClass[assetClassId]
  if (!product) throw new Error(`Missing seeded ${assetClassId} product.`)
  const order = await post('/orders', {
    productId: product.id,
    atomicAmount: amount,
    ...(outcomeKey ? { outcomeKey } : {}),
    riskAccepted: true,
  }, { ...headers, 'idempotency-key': idempotency(`acceptance-${assetClassId}`) })
  const completed = await post(`/demo-admin/orders/${order.id}/advance`, { state: 'filled' })
  if (completed.state !== 'filled') throw new Error(`${assetClassId} order was not filled.`)
  return completed
}

const rwa = await createAndFill('rwa', '5000000000')
const batch = await post('/demo-admin/yields', {
  productId: rwa.productId,
  totalAtomicAmount: '100000000',
  periodStart: new Date(Date.now() - 86_400_000).toISOString(),
  periodEnd: new Date().toISOString(),
})
const preview = await post(`/demo-admin/yields/${batch.id}/preview`, {})
if (!preview.allocations?.length) throw new Error('Yield preview created no allocations.')
await post(`/demo-admin/yields/${batch.id}/approve`, {})
const completedBatch = await post(`/demo-admin/yields/${batch.id}/execute`, {})
if (completedBatch.state !== 'completed') throw new Error('Yield batch did not complete.')

await createAndFill('compute', '100000000')
await createAndFill('stocks', '50000000')
const predictionMarket = await post('/demo-admin/predictions', {})
const prediction = await createAndFill('prediction', '50000000', 'yes', predictionMarket)
await post('/demo-admin/predictions/settle', { productId: prediction.productId, outcomeKey: 'yes' })

const positions = await request(`/portfolio/positions?user_id=${encodeURIComponent(login.userId)}`)
const rwaPosition = positions.find((position) => position.productId === rwa.productId && position.outcomeKey === 'long')
if (!rwaPosition || BigInt(rwaPosition.quantityAtomicAmount) < 100000000n) {
  throw new Error('Filled RWA order did not produce a redeemable server-side position.')
}
const redemption = await post(`/portfolio/redemptions?user_id=${encodeURIComponent(login.userId)}`, {
  productId: rwa.productId,
  quantityAtomicAmount: '100000000',
  requestId: `acceptance-redemption-${randomUUID()}`,
})
const completedRedemption = await post(`/demo-admin/orders/redemptions/${redemption.id}/complete`, {})
if (completedRedemption.state !== 'completed') throw new Error('Demo redemption did not complete.')

const recipientEmail = `recipient-${Date.now()}-${randomBytes(4).toString('hex')}@demo.rwa.lat`
const recipientRegistration = await post('/auth/demo/register', { email: recipientEmail, locale: 'en' })
const transfer = await post('/wallet/transfers', {
  recipientUserId: recipientRegistration.userId,
  atomicAmount: '10000000',
}, { ...headers, 'idempotency-key': idempotency('acceptance-transfer') })
if (transfer.state !== 'posted') throw new Error('Internal transfer was not posted.')

const withdrawal = await post('/wallet/withdrawals', {
  network: 'arbitrum',
  destination: `0x${'a'.repeat(40)}`,
  atomicAmount: '10000000',
}, { ...headers, 'idempotency-key': idempotency('acceptance-withdrawal') })
const completedWithdrawal = await post(`/demo-admin/withdrawals/${withdrawal.id}/complete`, {})
if (completedWithdrawal.state !== 'completed') throw new Error('Demo withdrawal did not complete.')

const ticket = await post(`/user-ops/tickets?author_user_id=${encodeURIComponent(login.userId)}`, {
  subject: 'Demo order review',
  body: 'Please review the completed demo order.',
  category: 'dispute',
  order_id: rwa.id,
  priority: 'normal',
})
await post(`/user-ops/tickets/${ticket.id}/messages?author_user_id=${encodeURIComponent(login.userId)}`, {
  body: 'I have attached the requested Demo details.',
  attachments: { demo: true },
})
const adminTicket = await post(`/demo-admin/tickets/${ticket.id}/respond`, {
  body: 'Demo operations is reviewing this request.',
  status: 'investigating',
  assignee: 'demo-ops',
})
const ticketTimeline = await request(`/user-ops/tickets/${ticket.id}/timeline?author_user_id=${encodeURIComponent(login.userId)}`)
if (adminTicket.ticket.status !== 'investigating' || ticketTimeline.messages.at(-1)?.actorType !== 'admin') {
  throw new Error('Support ticket timeline did not persist the Demo admin response.')
}

const invitation = await post(`/user-ops/invitations?inviter_user_id=${encodeURIComponent(login.userId)}`, {
  email: recipientEmail,
  role: 'member',
})
const acceptedInvitation = await post(`/user-ops/invitations/accept?user_id=${encodeURIComponent(recipientRegistration.userId)}`, {
  token: invitation.token,
})
const inviterRewards = await request(`/user-ops/rewards?user_id=${encodeURIComponent(login.userId)}`)
const recipientRewards = await request(`/user-ops/rewards?user_id=${encodeURIComponent(recipientRegistration.userId)}`)
if (acceptedInvitation.invitation.state !== 'accepted' || !inviterRewards.length || !recipientRewards.length) {
  throw new Error('Referral acceptance did not persist both reward records.')
}

const preferences = await put(`/user-ops/preferences?user_id=${encodeURIComponent(login.userId)}`, {
  locale: 'en',
  channels: { in_app: true, email: true, sms: false, push: true },
  communication_consent: true,
})
if (!preferences.communicationConsent || !preferences.channels.email || !preferences.channels.push) {
  throw new Error('Marketing preferences were not persisted.')
}

const notifications = await request(`/notifications?recipient_user_id=${encodeURIComponent(login.userId)}`)
if (!notifications.length) throw new Error('Financial workflow did not create user notifications.')
await post(`/notifications/read-all?recipient_user_id=${encodeURIComponent(login.userId)}`, {})
const unreadNotifications = await request(`/notifications?recipient_user_id=${encodeURIComponent(login.userId)}&filter=unread`)
if (unreadNotifications.length) throw new Error('Notifications were not marked read server-side.')

const wallet = await request('/wallet', { headers })
const recipientLogin = await post('/auth/demo/login', { email: recipientEmail, type: 'user' })
const recipientWallet = await request('/wallet', { headers: authHeaders(recipientLogin.token) })
const orders = await request('/orders', { headers })
const yields = await request('/yield', { headers })
const ledger = await request('/ledger/transactions', { headers })
const result = {
  userId: login.userId,
  email,
  depositState: deposit.deposit.state,
  filledOrders: orders.filter((order) => order.state === 'filled').length,
  completedYieldBatches: yields.filter((allocation) => allocation.state === 'credited').length,
  walletAvailableAtomic: wallet.balances.availableAtomic,
  walletLockedAtomic: wallet.balances.lockedAtomic,
  recipientAvailableAtomic: recipientWallet.balances.availableAtomic,
  ledgerTransactionCount: ledger.transactions.length,
  supportTicketState: ticketTimeline.ticket.status,
  referralRewards: { inviter: inviterRewards.length, invitee: recipientRewards.length },
  unreadNotifications: unreadNotifications.length,
}
if (result.filledOrders < 4 || result.completedYieldBatches < 1 || result.walletLockedAtomic !== '0' || result.recipientAvailableAtomic !== '10000000' || result.supportTicketState !== 'investigating' || result.referralRewards.inviter < 1 || result.referralRewards.invitee < 1 || result.unreadNotifications !== 0) {
  throw new Error(`Unexpected final Demo state: ${JSON.stringify(result)}`)
}
console.log(JSON.stringify(result))
