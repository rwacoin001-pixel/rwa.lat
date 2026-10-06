import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import type { AuthenticatedRequest } from './session-auth.guard'

/**
 * Money-moving and legally binding actions need a verified account email.
 * Runs after SessionAuthGuard; sign-in itself is never blocked on an email.
 * Without one it throws AUTH_FLOW_REQUIRED (step='email', emailRequired=true).
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly identity: IdentityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    await this.identity.requireVerifiedEmail(request.auth.userId)
    return true
  }
}
