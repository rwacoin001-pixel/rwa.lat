import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { SessionAuthService } from './session-auth.service'

export type OptionallyAuthenticatedRequest = Request & {
  auth?: { userId: string; sessionId: string; deviceId: string | null }
  requestId?: string
}

/**
 * Optional session authentication for public endpoints that enrich the response
 * when the caller is signed in (e.g. public basket portfolio detail returning
 * `yourUnits`). Missing or invalid tokens are treated as anonymous — a public
 * endpoint must not fail because of a stale credential.
 */
@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OptionallyAuthenticatedRequest>()
    const authorization = request.header('authorization')
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return true
    try {
      request.auth = await this.sessions.authenticate(token)
    } catch {
      // Anonymous fallback — public read stays available.
    }
    return true
  }
}
