import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedRequest } from './session-auth.guard'
import { CurrentAuth } from './current-auth.decorator'
import {
  PasskeyAssertionFinishDto,
  PasskeyFinishDto,
  RecoveryCodeDto,
  StepUpDto,
  TotpCodeDto,
  TotpEnrollmentDto,
} from './dto/security.dto'
import { SecurityService, type SecurityActor } from './security.service'
import { SessionAuthGuard } from './session-auth.guard'

@ApiTags('security')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List the current account sessions and their recognized devices' })
  sessions(@CurrentAuth() actor: SecurityActor) {
    return this.security.listSessions(actor)
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Revoke one current or historical session' })
  revokeSession(@CurrentAuth() actor: SecurityActor, @Param('sessionId') sessionId: string, @Req() request: AuthenticatedRequest) {
    return this.security.revokeSession(actor, sessionId, this.requestId(request))
  }

  @Post('sessions/revoke-others')
  @ApiOperation({ summary: 'Revoke every active session except the session making this request' })
  revokeOtherSessions(@CurrentAuth() actor: SecurityActor, @Req() request: AuthenticatedRequest) {
    return this.security.revokeOtherSessions(actor, this.requestId(request))
  }

  @Get('devices')
  @ApiOperation({ summary: 'List recognized devices and current trust state' })
  devices(@CurrentAuth() actor: SecurityActor) {
    return this.security.listDevices(actor)
  }

  @Delete('devices/:deviceId')
  @ApiOperation({ summary: 'Revoke a device and all active sessions on it' })
  revokeDevice(@CurrentAuth() actor: SecurityActor, @Param('deviceId') deviceId: string, @Req() request: AuthenticatedRequest) {
    return this.security.revokeDevice(actor, deviceId, this.requestId(request))
  }

  @Get('factors')
  @ApiOperation({ summary: 'List TOTP and passkey factors without returning secrets or public-key material' })
  factors(@CurrentAuth() actor: SecurityActor) {
    return this.security.listFactors(actor)
  }

  @Delete('factors/totp/:factorId')
  @ApiOperation({ summary: 'Revoke an authenticator-app factor after recent step-up verification' })
  revokeTotpFactor(
    @CurrentAuth() actor: SecurityActor,
    @Param('factorId') factorId: string,
    @Body() dto: StepUpDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.security.revokeTotpFactor(actor, factorId, dto.reauthentication, this.requestId(request))
  }

  @Delete('passkeys/:passkeyId')
  @ApiOperation({ summary: 'Revoke a passkey after recent step-up verification' })
  revokePasskey(
    @CurrentAuth() actor: SecurityActor,
    @Param('passkeyId') passkeyId: string,
    @Body() dto: StepUpDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.security.revokePasskey(actor, passkeyId, dto.reauthentication, this.requestId(request))
  }

  @Post('totp/enrollment')
  @ApiOperation({ summary: 'Begin TOTP authenticator-app enrollment and issue one-time recovery codes' })
  beginTotp(@CurrentAuth() actor: SecurityActor, @Req() request: AuthenticatedRequest) {
    return this.security.beginTotpEnrollment(actor, this.requestId(request))
  }

  @Post('totp/enrollment/confirm')
  @ApiOperation({ summary: 'Confirm the first TOTP code and activate the factor' })
  confirmTotp(@CurrentAuth() actor: SecurityActor, @Body() dto: TotpEnrollmentDto, @Req() request: AuthenticatedRequest) {
    return this.security.confirmTotpEnrollment(actor, dto.factorId, dto.code, this.requestId(request))
  }

  @Post('step-up/totp')
  @ApiOperation({ summary: 'Verify TOTP and issue a five-minute sensitive-action reauthentication token' })
  verifyTotp(@CurrentAuth() actor: SecurityActor, @Body() dto: TotpCodeDto, @Req() request: AuthenticatedRequest) {
    return this.security.verifyTotpStepUp(actor, dto.code, this.requestId(request))
  }

  @Post('step-up/recovery-code')
  @ApiOperation({ summary: 'Use a one-time recovery code for a five-minute sensitive-action reauthentication token' })
  verifyRecoveryCode(@CurrentAuth() actor: SecurityActor, @Body() dto: RecoveryCodeDto, @Req() request: AuthenticatedRequest) {
    return this.security.verifyRecoveryCode(actor, dto.code, this.requestId(request))
  }

  @Post('passkeys/registration')
  @ApiOperation({ summary: 'Create WebAuthn registration options for the signed-in user' })
  beginPasskeyRegistration(@CurrentAuth() actor: SecurityActor, @Req() request: AuthenticatedRequest) {
    return this.security.beginPasskeyRegistration(actor, this.requestId(request))
  }

  @Post('passkeys/registration/finish')
  @ApiOperation({ summary: 'Verify and persist a WebAuthn passkey registration' })
  finishPasskeyRegistration(@CurrentAuth() actor: SecurityActor, @Body() dto: PasskeyFinishDto, @Req() request: AuthenticatedRequest) {
    return this.security.finishPasskeyRegistration(actor, dto.challengeId, dto.response, dto.label, this.requestId(request))
  }

  @Post('step-up/passkey')
  @ApiOperation({ summary: 'Create WebAuthn assertion options for sensitive-action reauthentication' })
  beginPasskeyAssertion(@CurrentAuth() actor: SecurityActor, @Req() request: AuthenticatedRequest) {
    return this.security.beginPasskeyAssertion(actor, this.requestId(request))
  }

  @Post('step-up/passkey/finish')
  @ApiOperation({ summary: 'Verify WebAuthn assertion and issue a five-minute reauthentication token' })
  finishPasskeyAssertion(@CurrentAuth() actor: SecurityActor, @Body() dto: PasskeyAssertionFinishDto, @Req() request: AuthenticatedRequest) {
    return this.security.finishPasskeyAssertion(actor, dto.challengeId, dto.response, this.requestId(request))
  }

  @Post('devices/current/trust')
  @ApiOperation({ summary: 'Mark the current device trusted after recent step-up verification' })
  trustCurrentDevice(@CurrentAuth() actor: SecurityActor, @Body() dto: StepUpDto, @Req() request: AuthenticatedRequest) {
    return this.security.trustCurrentDevice(actor, dto.reauthentication, this.requestId(request))
  }

  @Get('events')
  @ApiOkResponse({ description: 'Latest immutable security audit records for the signed-in user.' })
  @ApiOperation({ summary: 'List the latest security events' })
  events(@CurrentAuth() actor: SecurityActor) {
    return this.security.listEvents(actor)
  }

  private requestId(request: AuthenticatedRequest) {
    return request.requestId ?? request.header('x-request-id') ?? 'unknown'
  }
}
