import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { NativeKycService, type CapturedFile } from './native-kyc.service'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard } from '../security/session-auth.guard'
import type { SecurityActor } from '../security/security.service'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { ComplianceService } from './compliance.service'
import { RiskProfileService } from './risk-profile.service'
import { SubmitRiskProfileDto } from './dto/risk-profile.dto'
import {
  DecideKycDto,
  CaptureKycDto,
  CreateHostedKycSessionDto,
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
    private readonly riskProfiles: RiskProfileService,
    private readonly rbac: AdminRbacService,
    private readonly nativeKyc: NativeKycService,
  ) {}

  @Get('kyc/capture-config')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  captureConfig() { return { enabled: this.nativeKyc.enabled() } }

  @Post('kyc/capture')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['documentType', 'front', 'selfie'], properties: { documentType: { type: 'string', enum: ['passport', 'id_card'] }, front: { type: 'string', format: 'binary' }, back: { type: 'string', format: 'binary' }, selfie: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }, { name: 'selfie', maxCount: 1 }], { limits: { files: 3, fileSize: 5 * 1024 * 1024, fields: 1, fieldSize: 128 } }))
  async captureKyc(@CurrentAuth() actor: SecurityActor, @Headers('idempotency-key') key: string | undefined, @Body() dto: CaptureKycDto, @UploadedFiles() files: { front?: CapturedFile[]; back?: CapturedFile[]; selfie?: CapturedFile[] }) {
    const result = await this.nativeKyc.capture(actor.userId, key, dto.documentType, files ?? {})
    if (result.state === 'approved' || result.state === 'rejected') await this.service.evaluateEligibility(actor.userId, 'default')
    return this.service.toPublicKycCase(result)
  }

  @Post('kyc/start')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  async startKyc(@CurrentAuth() actor: SecurityActor, @Body() dto: StartKycDto) {
    return this.service.toPublicKycCase(await this.service.startKyc(actor.userId, dto.provider))
  }

  @Post('kyc/submit')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  async submitKyc(@CurrentAuth() actor: SecurityActor, @Body() dto: SubmitKycDto) {
    return this.service.toPublicKycCase(await this.service.submitKyc(actor.userId, dto.providerCaseRef))
  }

  @Post('kyc/session')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  async createHostedKycSession(@CurrentAuth() actor: SecurityActor, @Body() dto: CreateHostedKycSessionDto) {
    const result = await this.service.createHostedKycSession(actor.userId, { language: dto.language })
    return {
      case: this.service.toPublicKycCase(result.case),
      verificationUrl: result.verificationUrl,
    }
  }

  @Post('kyc/webhooks/didit')
  @HttpCode(HttpStatus.OK)
  receiveDiditWebhook(
    @Headers('x-signature-v2') signatureV2: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-didit-test-webhook') testWebhook: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.receiveDiditWebhook({
      body,
      signatureV2,
      timestamp,
      isTest: testWebhook?.toLowerCase() === 'true',
    })
  }

  @Post('kyc/:caseId/decision')
  @ApiBearerAuth()
  @UseGuards(AdminSessionGuard)
  async decideKyc(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('caseId') caseId: string, @Body() dto: DecideKycDto) {
    await this.rbac.assertPermission(admin.id, 'compliance.manage')
    return this.service.toPublicKycCase(await this.service.decideKyc(caseId, dto.decision, dto.reasonCode, admin.id))
  }

  @Get('kyc/status')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  async kycStatus(@CurrentAuth() actor: SecurityActor) {
    return this.service.toPublicKycCase(await this.service.getKycStatus(actor.userId))
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

  @Get('risk-profile/questionnaire')
  getRiskQuestionnaire() {
    return this.riskProfiles.questionnaire
  }

  @Get('risk-profile')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  getRiskProfile(@CurrentAuth() actor: SecurityActor) {
    return this.riskProfiles.getProfile(actor.userId)
  }

  @Post('risk-profile')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  submitRiskProfile(@CurrentAuth() actor: SecurityActor, @Body() dto: SubmitRiskProfileDto) {
    return this.riskProfiles.submitProfile(actor.userId, dto.answers)
  }

  @Delete('risk-profile')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  deleteRiskProfile(@CurrentAuth() actor: SecurityActor) {
    return this.riskProfiles.deleteProfile(actor.userId)
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
