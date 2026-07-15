import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { ADMIN_PUBLIC } from './admin.guard.decorator'
import { AdminAuthService, type AdminSessionActor } from './admin-auth.service'

export type AdminRequest = Request & { admin?: AdminSessionActor }

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(ADMIN_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    const request = context.switchToHttp().getRequest<AdminRequest>()
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new UnauthorizedException('Admin session is required')
    request.admin = await this.auth.authenticate(token)
    return true
  }
}
