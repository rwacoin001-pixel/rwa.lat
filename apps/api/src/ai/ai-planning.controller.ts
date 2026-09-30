import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SessionAuthGuard, AuthenticatedRequest } from '../security/session-auth.guard'
import { CurrentAuth } from '../security/current-auth.decorator'
import { GenerateAiPlanDto, SaveAiGoalsDto } from './ai-planning.dto'
import { AiPlanningService } from './ai-planning.service'

@ApiTags('ai-planning')
@Controller('ai/planning')
@UseGuards(SessionAuthGuard)
export class AiPlanningController {
  constructor(private readonly plans: AiPlanningService) {}
  @Get('goals') goals(@CurrentAuth() auth: AuthenticatedRequest['auth']) { return this.plans.goals(auth.userId) }
  @Put('goals') save(@CurrentAuth() auth: AuthenticatedRequest['auth'], @Body() dto: SaveAiGoalsDto) { return this.plans.save(auth.userId,dto) }
  @Get('plans') list(@CurrentAuth() auth: AuthenticatedRequest['auth']) { return this.plans.list(auth.userId) }
  @Get('plans/:id') get(@CurrentAuth() auth: AuthenticatedRequest['auth'], @Param('id',ParseUUIDPipe) id: string) { return this.plans.get(auth.userId,id) }
  @Post('plans') generate(@CurrentAuth() auth: AuthenticatedRequest['auth'], @Body() dto: GenerateAiPlanDto, @Headers('idempotency-key') key?: string) { return this.plans.generate(auth.userId,dto.expectedRevision,key) }
}
