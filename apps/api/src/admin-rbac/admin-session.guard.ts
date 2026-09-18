import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { ADMIN_PUBLIC } from './admin.guard.decorator'
import { AdminSessionAuthService, type AuthenticatedAdmin } from './admin-session-auth.service'

export type AdminAuthenticatedRequest = Request & { admin?: AuthenticatedAdmin }

export const ADMIN_ACTOR_HEADER = 'x-actor-admin-id'
const SERVICE_TOKEN_MIN_LENGTH = 32

/**
 * 管理员请求守卫（两种身份）：
 * 1) 真实管理员会话 token（核心库 admin_sessions，浏览器直连场景）。
 * 2) 服务通道：admin 控制台（admin-api）转发时携带共享服务令牌 ADMIN_SERVICE_TOKEN +
 *    `x-actor-admin-id`（代签管理员号，仅作为审计 actor 落库）。RBAC 已在管理 API 侧执行；
 *    服务令牌本身即最高权限凭证（与 internal 通道同一安全模型）。
 */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  private readonly serviceTokenHash: Buffer | null

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: AdminSessionAuthService,
    config: ConfigService,
  ) {
    const token = config.get<string>('ADMIN_SERVICE_TOKEN')?.trim() || ''
    this.serviceTokenHash = token.length >= SERVICE_TOKEN_MIN_LENGTH ? createHash('sha256').update(token).digest() : null
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(ADMIN_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>()
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    if (!token) throw new UnauthorizedException('Admin session is required')

    if (this.serviceTokenHash) {
      const suppliedHash = createHash('sha256').update(token).digest()
      if (timingSafeEqual(suppliedHash, this.serviceTokenHash)) {
        const actor = String(request.headers[ADMIN_ACTOR_HEADER] ?? '').trim()
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor)) {
          throw new UnauthorizedException(`A valid ${ADMIN_ACTOR_HEADER} header is required for service-channel requests.`)
        }
        request.admin = {
          id: actor,
          email: 'console-service@rwa.lat',
          roleId: 'service-channel',
          roleName: 'service-channel',
          permissions: ['*'],
          sessionId: `service:${actor}`,
        }
        return true
      }
    }

    request.admin = await this.sessions.authenticate(token)
    return true
  }
}
