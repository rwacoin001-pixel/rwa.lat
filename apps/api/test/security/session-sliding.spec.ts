import { SESSION_IDLE_MS, SESSION_MAX_MS, SessionAuthService } from '../../src/security/session-auth.service'

const DAY = 24 * 60 * 60 * 1000

function service(session: Record<string, unknown>) {
  const sessions = { findOne: jest.fn(async () => session), save: jest.fn(async (value: unknown) => value) }
  const crypto = { hashToken: jest.fn(() => Buffer.from('h')) }
  return { svc: new SessionAuthService(sessions as never, crypto as never), sessions }
}

describe('SessionAuthService sliding expiry', () => {
  it('pushes the expiry to 30 days from now when a session is used', async () => {
    const now = Date.now()
    const session = { id: 's', userId: 'u', deviceId: null, state: 'active', createdAt: new Date(now - 10 * DAY), expiresAt: new Date(now + 20 * DAY) }
    await service(session).svc.authenticate('t')
    expect(Math.abs((session.expiresAt as Date).getTime() - (now + SESSION_IDLE_MS))).toBeLessThan(5_000)
  })

  it('never goes past 180 days from sign-in', async () => {
    const now = Date.now()
    const created = now - 170 * DAY
    const session = { id: 's', userId: 'u', deviceId: null, state: 'active', createdAt: new Date(created), expiresAt: new Date(now + 2 * DAY) }
    await service(session).svc.authenticate('t')
    expect((session.expiresAt as Date).getTime()).toBe(created + SESSION_MAX_MS)
  })

  it('leaves a fresh expiry alone (no write-amplifying slide on every request)', async () => {
    const now = Date.now()
    const expires = new Date(now + SESSION_IDLE_MS - 60_000)
    const session = { id: 's', userId: 'u', deviceId: null, state: 'active', createdAt: new Date(now - DAY), expiresAt: expires }
    await service(session).svc.authenticate('t')
    expect(session.expiresAt).toBe(expires)
  })
})
