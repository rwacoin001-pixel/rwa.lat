import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../security/session-auth.guard'
import { SessionAuthService } from '../security/session-auth.service'

/**
 * Public community reads stay anonymous, but a signed-in viewer is recognised so members-only (circle) posts can be shown
 * to their members. A missing or invalid token simply means "anonymous"; it never fails the request.
 */
@Injectable()
export class CommunityOptionalAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionAuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = request.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return true
    try {
      request.auth = await this.sessions.authenticate(token)
      context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'private, no-store')
    } catch { /* anonymous */ }
    return true
  }
}
