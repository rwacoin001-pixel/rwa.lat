import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { AuthenticatedRequest } from '../security/session-auth.guard'
import { RewardsService } from './rewards.service'

/** Runs after session auth and before DTO pipes, so disabled users always receive 404. */
@Injectable()
export class RewardsLiveGuard implements CanActivate {
  constructor(private readonly rewards: RewardsService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    await this.rewards.assertLive(request.auth.userId)
    return true
  }
}
