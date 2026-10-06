import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { IdentityService } from '../identity/identity.service'
import type { AuthenticatedRequest } from './session-auth.guard'

/**
 * Money-moving and legally binding actions need a verified account email.
 * Runs after SessionAuthGuard; sign-in itself is never blocked on an email.
 * Without one it throws AUTH_FLOW_REQUIRED (step='email', emailRequired=true).
 *
 * @UseGuards() instantiates this guard inside each controller's host module, and most of
 * those modules don't import IdentityModule. So IdentityService is not constructor-injected;
 * it is looked up app-wide through ModuleRef (always injectable) on first use.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  private identity?: IdentityService

  constructor(private readonly moduleRef: ModuleRef) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    this.identity ??= this.moduleRef.get(IdentityService, { strict: false })
    await this.identity.requireVerifiedEmail(request.auth.userId)
    return true
  }
}
