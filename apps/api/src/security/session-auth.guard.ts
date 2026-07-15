import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import { Repository } from 'typeorm'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { Session } from '../identity/session.entity'
import { SECURITY_ERROR_CODES } from './security.errors'

export interface AuthenticatedRequest extends Request {
  auth: {
    userId: string
    sessionId: string
    deviceId: string | null
  }
  requestId?: string
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly crypto: IdentityCrypto,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authorization = request.header('authorization')
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) {
      throw new UnauthorizedException({
        code: SECURITY_ERROR_CODES.AUTHENTICATION_REQUIRED,
        message: 'A valid session token is required.',
      })
    }

    const session = await this.sessions.findOne({
      where: { tokenHash: this.crypto.hashToken(token), state: 'active' },
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
    request.auth = { userId: session.userId, sessionId: session.id, deviceId: session.deviceId }
    return true
  }
}
