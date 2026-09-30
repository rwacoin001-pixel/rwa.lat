import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common'
import { CurrentAuth } from '../security/current-auth.decorator'
import { AuthenticatedRequest, SessionAuthGuard } from '../security/session-auth.guard'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { AiMandateService } from './ai-mandate.service'
import { AiAutomaticService } from './ai-automatic.service'
import { AiMandateDto, AiMandateStateDto, AiEvaluateDto, AiExecutionRuleDto } from './ai-mandate.dto'
import { IsString, Length } from 'class-validator'
class AiRunReviewDto { @IsString() @Length(1,2000) note!: string }

@Controller('ai/investment') @UseGuards(SessionAuthGuard)
export class AiMandateController {
  constructor(private readonly mandates: AiMandateService,private readonly automatic: AiAutomaticService) {}
  @Get('mandate') get(@CurrentAuth() auth: AuthenticatedRequest['auth']) { return this.mandates.get(auth.userId) }
  @Get('choices') choices(@CurrentAuth() auth: AuthenticatedRequest['auth']) { return this.mandates.choices(auth.userId) }
  @Get('mandate/history') history(@CurrentAuth() auth: AuthenticatedRequest['auth']) { return this.mandates.history(auth.userId) }
  @Put('mandate') confirm(@CurrentAuth() auth: AuthenticatedRequest['auth'],@Body() body: AiMandateDto) { return this.mandates.confirm(auth.userId,auth.sessionId,body) }
  @Post('mandate/pause') pause(@CurrentAuth() auth: AuthenticatedRequest['auth'],@Body() body: AiMandateStateDto) { return this.mandates.changeState(auth.userId,body.expectedRevision,auth.sessionId,'paused') }
  @Post('mandate/revoke') revoke(@CurrentAuth() auth: AuthenticatedRequest['auth'],@Body() body: AiMandateStateDto) { return this.mandates.changeState(auth.userId,body.expectedRevision,auth.sessionId,'revoked') }
  @Post('mandate/resume') resume(@CurrentAuth() auth: AuthenticatedRequest['auth'],@Body() body: AiMandateStateDto) { return this.mandates.changeState(auth.userId,body.expectedRevision,auth.sessionId,'active') }
  @Get('runs') runs(@CurrentAuth() auth: AuthenticatedRequest['auth']) { return this.automatic.runs(auth.userId) }
  @Get('runs/:id') run(@CurrentAuth() auth: AuthenticatedRequest['auth'],@Param('id',ParseUUIDPipe) id: string) { return this.automatic.get(auth.userId,id) }
  @Post('evaluate') evaluate(@CurrentAuth() auth: AuthenticatedRequest['auth'],@Body() body: AiEvaluateDto) { return this.automatic.evaluate(auth.userId,body.expectedRevision,body.idempotencyKey) }
  @Post('runs/:id/cancel') cancel(@CurrentAuth() auth: AuthenticatedRequest['auth'],@Param('id',ParseUUIDPipe) id: string) { return this.automatic.cancel(auth.userId,id) }
}

@Controller('admin/ai-investment') @UseGuards(AdminSessionGuard)
export class AdminAiInvestmentController {
  constructor(private readonly mandates: AiMandateService,private readonly automatic: AiAutomaticService,private readonly rbac: AdminRbacService) {}
  @Get('rules') async rules(@CurrentAdmin() admin: AuthenticatedAdmin) { await this.permission(admin); return this.mandates.listRules() }
  @Put('rules/:id') async save(@CurrentAdmin() admin: AuthenticatedAdmin,@Param('id',ParseUUIDPipe) id: string,@Body() body: AiExecutionRuleDto) { await this.permission(admin); return this.mandates.saveRule(id,body,admin.id) }
  @Get('runs') async runs(@CurrentAdmin() admin: AuthenticatedAdmin) { await this.permission(admin); return this.automatic.adminRuns() }
  @Post('runs/:id/review') async review(@CurrentAdmin() admin: AuthenticatedAdmin,@Param('id',ParseUUIDPipe) id: string,@Body() body: AiRunReviewDto) { await this.permission(admin); return this.automatic.review(id,admin.id,body.note) }
  private permission(admin: AuthenticatedAdmin) { return this.rbac.assertPermission(admin.id,'platform.manage') }
}
