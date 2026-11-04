import { Body, Controller, Get, Header, Module, Put, Query, Req, UseGuards } from '@nestjs/common'
import { IsBoolean } from 'class-validator'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { OptionalSessionAuthGuard, type OptionallyAuthenticatedRequest } from '../security/optional-session-auth.guard'
import { SecurityModule } from '../security/security.module'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { MembershipService } from './membership.service'
import { RankingService } from './ranking.service'
import { MembershipRunner } from './membership.runner'

class RankVisibilityDto { @IsBoolean() hidden!:boolean }
@Controller('membership')
@UseGuards(SessionAuthGuard)
export class MembershipController {
  constructor(private readonly membership:MembershipService) {}
  @Get('me') me(@Req() req:AuthenticatedRequest) { return this.membership.me(req.auth.userId) }
  @Put('rank-visibility') visibility(@Req() req:AuthenticatedRequest,@Body() body:RankVisibilityDto) { return this.membership.visibility(req.auth.userId,body.hidden) }
}
@Controller('rank')
export class RankingController {
  constructor(private readonly ranking:RankingService) {}
  @Get() @UseGuards(OptionalSessionAuthGuard) @Header('Cache-Control','private, no-store')
  read(@Query('board') board?:string,@Query('period') period?:string,@Req() req?:OptionallyAuthenticatedRequest) {
    return this.ranking.read(board,period,req?.auth?.userId)
  }
}
@Module({imports:[SecurityModule,JobQueueModule],controllers:[MembershipController,RankingController],
  providers:[MembershipService,RankingService,MembershipRunner]})
export class MembershipModule {}
