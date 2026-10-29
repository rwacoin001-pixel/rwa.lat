import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ApiRateLimiter } from '../common/api-rate-limit.middleware'
import { verifiedEdgeClient } from '../common/edge-client'

@Injectable()
export class AiChatRateLimitGuard implements CanActivate {
  private readonly limiter = new ApiRateLimiter()
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { auth?: { userId: string | null } }>()
    const response = context.switchToHttp().getResponse<Response>()
    const decision = this.limiter.consumeAi(request.auth?.userId ?? null, verifiedEdgeClient(response)?.ip || request.ip || request.socket.remoteAddress || 'unknown')
    if (!decision.allowed) {
      response.setHeader('Retry-After', String(decision.retryAfterSeconds))
      throw new HttpException({ code: 'AI_RATE_LIMIT_EXCEEDED', message: 'Too many messages. Please try again later.' }, 429)
    }
    return true
  }
}
