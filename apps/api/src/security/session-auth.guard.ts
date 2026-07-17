import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { SECURITY_ERROR_CODES } from './security.errors'
import { SessionAuthService } from './session-auth.service'

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
  constructor(private readonly sessions: SessionAuthService) {}

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

    request.auth = await this.sessions.authenticate(token)
    return true
  }
}
