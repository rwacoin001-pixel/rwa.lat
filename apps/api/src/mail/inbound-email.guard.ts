import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'

export function verifyInboundSignature(header: string | undefined, body: Buffer | undefined, secret: string | undefined, now = Date.now()): boolean {
  const match = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(header ?? '')
  if (!secret || secret.length < 32 || !body || !match || Math.abs(Math.floor(now / 1000) - Number(match[1])) > 300) return false
  const expected = createHmac('sha256', secret).update(`${match[1]}.`).update(body).digest()
  return timingSafeEqual(expected, Buffer.from(match[2], 'hex'))
}

@Injectable()
export class InboundEmailGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>()
    if (!verifyInboundSignature(request.get('X-Inbound-Signature'), request.rawBody, this.config.get<string>('INBOUND_EMAIL_SECRET'))) {
      throw new UnauthorizedException('Invalid inbound email signature')
    }
    return true
  }
}
