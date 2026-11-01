import { Controller, Get, Headers, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { verifiedEdgeClient } from '../common/edge-client'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { isIP } from 'node:net'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { RewardPointsQueryDto } from './rewards.dto'
import { RewardsService } from './rewards.service'
import { RewardsLiveGuard } from './rewards-live.guard'

@ApiTags('rewards')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard, RewardsLiveGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}
  @Get('today')
  today(@CurrentAuth() a: AuthenticatedRequest['auth']) { return this.rewards.today(a.userId) }
  @Post('draw')
  @HttpCode(200)
  draw(@CurrentAuth() a: AuthenticatedRequest['auth'], @Headers('idempotency-key') key: string, @Res({ passthrough: true }) res: Response) {
    // Requests reach the API through the frontend Worker, so Express's req.ip is the Worker's address and would freeze
    // everyone as "shared". Only the signed edge client IP counts; without it the shared-IP check is skipped.
    const ip = verifiedEdgeClient(res)?.ip?.replace(/^::ffff:(?=\d+\.)/, '')
    return this.rewards.draw(a.userId, key, ip && isIP(ip) ? ip : null)
  }
  @Get('wallet')
  wallet(@CurrentAuth() a: AuthenticatedRequest['auth']) { return this.rewards.wallet(a.userId) }
  @Get('points')
  points(@CurrentAuth() a: AuthenticatedRequest['auth'], @Query() q: RewardPointsQueryDto) { return this.rewards.points(a.userId, q.cursor) }
  @Post('points/exchange')
  @HttpCode(200)
  exchange(@CurrentAuth() a: AuthenticatedRequest['auth'], @Headers('idempotency-key') key: string) { return this.rewards.exchange(a.userId, key) }
}
