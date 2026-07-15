import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard } from '../security/session-auth.guard'
import type { SecurityActor } from '../security/security.service'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { ComplianceService } from './compliance.service'
import {
  DecideKycDto,
  EvaluateEligibilityDto,
  OpenRiskFlagDto,
  ResolveRiskFlagDto,
  ScreenDto,
  StartKycDto,
  SubmitKycDto,
} from './dto/compliance.dto'

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(
    private readonly service: ComplianceService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Post('kyc/start')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  startKyc(@CurrentAuth() actor: SecurityActor, @Body() dto: StartKycDto) {
    return this.service.startKyc(actor.userId, dto.provider)
  }

  @Post('kyc/submit')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  submitKyc(@CurrentAuth() actor: SecurityActor, @Body() dto: SubmitKycDto) {
    return this.service.submitKyc(actor.userId, dto.providerCaseRef)
  }

  @Post('kyc/:caseId/decision')
  @ApiBearerAuth()
  @UseGuards(AdminSessionGuard)
  async decideKyc(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('caseId') caseId: string, @Body() dto: DecideKycDto) {
    await this.rbac.assertPermission(admin.id, 'compliance.manage')
    return this.service.decideKyc(caseId, dto.decision, dto.reasonCode)
  }

  @Get('kyc/status')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  kycStatus(@CurrentAuth() actor: SecurityActor) {
    return this.service.getKycStatus(actor.userId)
  }

  @Post('screening')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  screen(@CurrentAuth() actor: SecurityActor, @Body() dto: ScreenDto) {
    return this.service.screen(actor.userId, dto.kind, dto.identifiers ?? {})
  }

  @Get('screening')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  listScreening(@CurrentAuth() actor: SecurityActor) {
    return this.service.listScreening(actor.userId)
  }

  @Post('eligibility/evaluate')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  evaluate(@CurrentAuth() actor: SecurityActor, @Body() dto: EvaluateEligibilityDto) {
    return this.service.evaluateEligibility(actor.userId, dto.productScope, dto.region)
  }

  @Get('eligibility/:productScope')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  getEligibility(@CurrentAuth() actor: SecurityActor, @Param('productScope') productScope: string) {
    return this.service.getEligibility(actor.userId, productScope)
  }

  @Post('risk-flags')
  @ApiBearerAuth()
  @UseGuards(AdminSessionGuard)
  async openRiskFlag(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: OpenRiskFlagDto) {
    await this.rbac.assertPermission(admin.id, 'compliance.manage')
    return this.service.openRiskFlag(dto.userId, dto.category, dto.severity, dto.source, dto.reasonCode)
  }

  @Put('risk-flags/:id')
  @ApiBearerAuth()
  @UseGuards(AdminSessionGuard)
  async resolveRiskFlag(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string, @Body() dto: ResolveRiskFlagDto) {
    await this.rbac.assertPermission(admin.id, 'compliance.manage')
    return this.service.resolveRiskFlag(id, dto.state)
  }
}
