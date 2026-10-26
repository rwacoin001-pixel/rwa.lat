import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { Session } from '../identity/session.entity'
import { SECURITY_ERROR_CODES } from './security.errors'

const DAY_MS = 24 * 60 * 60 * 1000
export const SESSION_IDLE_MS = 30 * DAY_MS
export const SESSION_MAX_MS = 180 * DAY_MS
// Push the expiry out at most about once a day, not on every request.
const SESSION_SLIDE_STEP_MS = DAY_MS

export interface AuthenticatedSession {
  userId: string
  sessionId: string
  deviceId: string | null
}

@Injectable()
export class SessionAuthService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly crypto: IdentityCrypto,
  ) {}

  async authenticate(rawToken: string): Promise<AuthenticatedSession> {
    const session = await this.sessions.findOne({
      where: { tokenHash: this.crypto.hashToken(rawToken), state: 'active' },
    })
    if (!session) {
      throw new UnauthorizedException({
        code: SECURITY_ERROR_CODES.AUTHENTICATION_REQUIRED,
        message: 'The session is not active.',
      })
    }
    if (session.expiresAt <= new Date()) {
      session.state = 'expired'
      session.revokeReason = 'expired'
      await this.sessions.save(session)
      throw new UnauthorizedException({
        code: SECURITY_ERROR_CODES.SESSION_EXPIRED,
        message: 'The session has expired.',
      })
    }

    // Sliding, like a banking app: a session in use stays signed in (30 days from the last use), up to 180 days in all.
    // The app lock (passkey) guards opening it on the device; money-out keeps its own step-up.
    const now = Date.now()
    const slid = Math.min(now + SESSION_IDLE_MS, (session.createdAt?.getTime() ?? now) + SESSION_MAX_MS)
    if (slid - session.expiresAt.getTime() > SESSION_SLIDE_STEP_MS) session.expiresAt = new Date(slid)
    session.lastSeenAt = new Date(now)
    await this.sessions.save(session)
    return { userId: session.userId, sessionId: session.id, deviceId: session.deviceId }
  }
}
