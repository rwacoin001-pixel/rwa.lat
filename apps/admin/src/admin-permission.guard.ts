import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AdminRequest } from './admin-session.guard'

export const ADMIN_REQUIRED_PERMISSIONS = 'admin:required-permissions'
export const RequireAdminPermissions = (...permissions: string[]) => SetMetadata(ADMIN_REQUIRED_PERMISSIONS, permissions)

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ADMIN_REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]) ?? []
    if (!required.length) return true

    const actor = context.switchToHttp().getRequest<AdminRequest>().admin
    const granted = new Set(actor?.permissions ?? [])
    const missing = required.find((permission) => !granted.has(permission))
    if (missing) {
      throw new ForbiddenException({
        code: 'ADMIN_PERMISSION_DENIED',
        message: `Missing administrator permission: ${missing}`,
      })
    }
    return true
  }
}
