import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { SessionAuthGuard } from '../security/session-auth.guard'

/** Public reports retain their existing behavior; private messages always require a verified session. */
@Injectable()
export class CommunityReportAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionAuthGuard) {}
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    return context.switchToHttp().getRequest().body?.targetType === 'dm_message' ? this.sessions.canActivate(context) : true
  }
}
