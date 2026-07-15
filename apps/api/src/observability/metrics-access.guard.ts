import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { timingSafeEqual } from 'node:crypto'

@Injectable()
export class MetricsAccessGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('METRICS_BEARER_TOKEN')?.trim()
    if (!expected && this.config.get<string>('APP_ENV') !== 'production') return true

    const request = context.switchToHttp().getRequest<Request>()
    const authorization = request.headers.authorization
    const supplied = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : ''
    if (!expected || !constantTimeEqual(supplied, expected)) {
      throw new UnauthorizedException({
        code: 'METRICS_AUTHENTICATION_REQUIRED',
        message: 'Metrics authentication failed.',
      })
    }
    return true
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
