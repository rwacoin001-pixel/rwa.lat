import { afterEach, test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { closeTicket, createTicket, evaluateEligibility, getKyc, getTicketTimeline, putPreferences, removePasskey, replyTicket, submitRiskProfile } from '../lib/api/account'

afterEach(() => mock.restoreAll())

function capture(response: unknown, status = 200) {
  const calls: Array<{ path: string; method: string; body: unknown }> = []
  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: new URL(String(input), 'http://local.test').pathname, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
    return new Response(JSON.stringify(response), { status, headers: { 'content-type': 'application/json' } })
  })
  return calls
}

test('preferences preserve false and use the server write field communication_consent', async () => {
  const data = { userId: 'qa', channels: { email: false }, communicationConsent: false, updatedAt: '2026-09-25T00:00:00Z' }
  const calls = capture(data)
  assert.deepEqual(await putPreferences({ channels: { email: false }, communication_consent: false }), { ok: true, data })
  assert.deepEqual(calls[0], { path: '/v1/user-ops/preferences', method: 'PUT', body: { channels: { email: false }, communication_consent: false } })
})

test('support clients retain optional attachment IDs, priority and snake_case order_id', async () => {
  const calls = capture({})
  const body = { subject: 'QA', body: 'Detail', category: 'support' as const, priority: 'low' as const, order_id: 'order-id', attachmentObjectIds: ['object-id'] }
  await createTicket(body)
  await replyTicket('ticket-id', 'Reply', ['object-id'])
  await closeTicket('ticket-id')
  assert.deepEqual(calls, [
    { path: '/v1/user-ops/tickets', method: 'POST', body },
    { path: '/v1/user-ops/tickets/ticket-id/messages', method: 'POST', body: { body: 'Reply', attachmentObjectIds: ['object-id'] } },
    { path: '/v1/user-ops/tickets/ticket-id/close', method: 'PUT', body: {} },
  ])
})

test('path parameters cannot change the requested ticket route', async () => {
  const calls = capture({})
  await getTicketTimeline('ticket/another?x=1')
  assert.equal(calls[0].path, '/v1/user-ops/tickets/ticket%2Fanother%3Fx%3D1/timeline')
})

test('KYC absence remains null; an API failure stays an error result', async () => {
  capture(null)
  assert.deepEqual(await getKyc(), { ok: true, data: null })
  mock.restoreAll()
  capture({ code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' }, 503)
  const result = await getKyc()
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'SERVICE_UNAVAILABLE')
})

test('risk answers are not silently reindexed; eligibility carries an optional explicit region', async () => {
  const calls = capture({})
  await submitRiskProfile({ experience: 1, horizon: 5 })
  await evaluateEligibility('default', 'US')
  await evaluateEligibility('default')
  assert.deepEqual(calls.map((c) => c.body), [{ answers: { experience: 1, horizon: 5 } }, { productScope: 'default', region: 'US' }, { productScope: 'default' }])
})

test('passkey removal sends DELETE with the existing step-up contract', async () => {
  const calls = capture({ revoked: true, passkeyId: 'fixture' })
  const result = await removePasskey('fixture', 'synthetic-test-value')
  assert.deepEqual(result, { ok: true, data: { revoked: true, passkeyId: 'fixture' } })
  assert.deepEqual(calls[0], { path: '/v1/security/passkeys/fixture', method: 'DELETE', body: { reauthentication: 'synthetic-test-value' } })
})
