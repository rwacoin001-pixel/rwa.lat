import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { Session } from '../identity/session.entity'
import { SECURITY_ERROR_CODES } from './security.errors'

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

    session.lastSeenAt = new Date()
    await this.sessions.save(session)
    return { userId: session.userId, sessionId: session.id, deviceId: session.deviceId }
  }
}
