import { BadRequestException, Body, Controller, Get, Header, Headers, Param, Post, UnauthorizedException } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IdentityService } from './identity.service'
import { RegisterEmailDto } from './dto/register-email.dto'
import { PasswordLoginDto, PasswordManageDto, AuthFlowCompleteDto, AuthFlowTokenDto } from './dto/password-auth.dto'
import { LoginEmailDto } from './dto/login-email.dto'
import { PasskeyLoginChallengeDto, PasskeyLoginVerifyDto } from './dto/passkey-login.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { RecoverDto } from './dto/recover.dto'
import { RecoverConfirmDto } from './dto/recover-confirm.dto'
import { OAuthCallbackDto } from './dto/oauth-callback.dto'
import { OAuthStartDto } from './dto/oauth-start.dto'
import { RegisterEmailRequestDto } from './dto/register-email-request.dto'
import { WalletChallengeDto, WalletVerifyDto } from './dto/wallet.dto'
import { SessionViewDto } from './dto/session-view.dto'
import { EmailCodeService } from './email-code.service'
import { ConfirmEmailCodeDto, EmailCodeChallengeDto, EmailLookupDto, EmailLookupResultDto, RequestEmailCodeDto } from './dto/email-code.dto'

@ApiTags('identity')
@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService, private readonly emailCodes: EmailCodeService) {}

  @Post('login/password')
  @ApiOperation({ summary: 'Verify password and require account second-factor verification' })
  loginPassword(@Body() dto: PasswordLoginDto) { return this.identity.loginPassword(dto.email, dto.password, dto.device) }

  @Post('flow/complete')
  @ApiOperation({ summary: 'Complete a server-bound authentication step' })
  completeFlow(@Body() dto: AuthFlowCompleteDto) { return this.identity.completeAuthFlow(dto as Parameters<IdentityService['completeAuthFlow']>[0]) }

  @Post('flow/resend')
  @ApiOperation({ summary: 'Resend the email code for a pending authentication step' })
  resendFlow(@Body() dto: AuthFlowTokenDto) { return this.identity.resendAuthFlow(dto.continuationToken) }

  @Post('password/manage')
  @ApiOperation({ summary: 'Begin verified password setup or change for the signed-in account' })
  managePassword(@Headers('authorization') authorization: string | undefined, @Body() dto: PasswordManageDto) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Sign in first.' })
    return this.identity.managePassword(token, dto.device, dto.email)
  }

  @Post('email/lookup')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Email-first sign-in: whether the address belongs to an existing account' })
  @ApiCreatedResponse({ type: EmailLookupResultDto })
  lookupEmail(@Body() dto: EmailLookupDto) { return this.emailCodes.lookup(dto.email) }

  @Post('email-code/request')
  @ApiOperation({ summary: 'Send a six-digit mobile email verification code' })
  @ApiCreatedResponse({ type: EmailCodeChallengeDto, description: 'Challenge issued; code is delivered only by email.' })
  requestEmailCode(@Body() dto: RequestEmailCodeDto) { return this.emailCodes.request(dto) }

  @Post('email-code/confirm')
  @ApiOperation({ summary: 'Consume a mobile email code and open a session' })
  @ApiCreatedResponse({ description: 'Email verified; session issued.' })
  confirmEmailCode(@Body() dto: ConfirmEmailCodeDto) { return this.emailCodes.confirm(dto) }

  @Get('consent-requirements')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List the current documents required to create an account' })
  @ApiOkResponse({ description: 'Current registration consent requirements.' })
  consentRequirements() {
    return this.identity.consentRequirements()
  }

  @Post('register/email')
  @ApiOperation({ summary: 'Register a new account with an email address' })
  @ApiCreatedResponse({ description: 'Account created; email verification required.' })
  async registerEmail(@Body() dto: RegisterEmailRequestDto) {
    return this.identity.registerEmail(dto.email, dto.locale, dto.consents)
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify an email using the verification token' })
  @ApiOkResponse({ description: 'Email verified.' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.identity.verifyEmail(dto.token, dto.device)
  }

  @Post('login/email')
  @ApiOperation({ summary: 'Send a single-use email sign-in link (magic link)' })
  @ApiOkResponse({ description: 'Sign-in link dispatched if the address is registered.' })
  async loginEmail(@Body() dto: LoginEmailDto) {
    return this.identity.requestEmailLogin(dto.email)
  }

  @Post('login/email/confirm')
  @ApiOperation({ summary: 'Consume an email sign-in link token and open a session' })
  @ApiOkResponse({ description: 'Email login confirmed; session issued.' })
  async confirmLoginEmail(@Body() dto: VerifyEmailDto) {
    return this.identity.confirmEmailLogin(dto.token, dto.device)
  }

  @Post('passkey/challenge')
  @ApiOperation({ summary: 'Issue a WebAuthn authentication challenge for passkey login' })
  @ApiOkResponse({ description: 'Authentication options issued.' })
  async passkeyChallenge(@Body() dto: PasskeyLoginChallengeDto) {
    return this.identity.beginPasskeyLogin(dto.email)
  }

  @Post('passkey/verify')
  @ApiOperation({ summary: 'Verify a passkey assertion and open a session' })
  @ApiOkResponse({ description: 'Passkey login completed; session issued.' })
  async passkeyVerify(@Body() dto: PasskeyLoginVerifyDto) {
    return this.identity.finishPasskeyLogin(dto.challengeId, dto.response, dto.device)
  }

  @Post('wallet/challenge')
  @ApiOperation({ summary: 'Issue a single-use nonce for wallet signature' })
  @ApiOkResponse({ description: 'Challenge nonce issued.' })
  async walletChallenge(@Body() dto: WalletChallengeDto) {
    return this.identity.createWalletChallenge(dto.address, dto.chainId)
  }

  @Post('wallet/verify')
  @ApiOperation({ summary: 'Verify wallet signature and open a session' })
  @ApiOkResponse({ description: 'Wallet authenticated; session issued.' })
  async walletVerify(@Body() dto: WalletVerifyDto) {
    return this.identity.verifyWalletSignature(dto.address, dto.signature, dto.nonce, dto.device, dto.consents)
  }

  @Post('oauth/:provider')
  @ApiOperation({ summary: 'Exchange Google OAuth 2 code or verified X OAuth 1.0a verifier' })
  @ApiOkResponse({ description: 'OAuth identity resolved after server-side provider verification.' })
  async oauth(@Param('provider') provider: string, @Body() dto: OAuthCallbackDto) {
    if (provider !== 'google' && provider !== 'x') {
      throw new BadRequestException({ code: 'OAUTH_PROVIDER_UNSUPPORTED', message: 'Unsupported OAuth provider' })
    }
    return this.identity.exchangeOAuthCode(provider, dto.code, dto.state, dto.redirectUri, dto.device)
  }

  @Post('oauth/:provider/start')
  @ApiOperation({ summary: 'Create a server-bound Google OAuth 2 or X OAuth 1.0a authorization URL' })
  async oauthStart(@Param('provider') provider: string, @Body() dto?: OAuthStartDto) {
    if (provider !== 'google' && provider !== 'x') {
      throw new BadRequestException({ code: 'OAUTH_PROVIDER_UNSUPPORTED', message: 'Unsupported OAuth provider' })
    }
    return this.identity.beginOAuth(provider, dto?.intent ?? 'login', dto?.consents)
  }

  @Post('recover')
  @ApiOperation({ summary: 'Request an account recovery token' })
  @ApiOkResponse({ description: 'Recovery request processed.' })
  async recover(@Body() dto: RecoverDto) {
    return this.identity.recover(dto.email)
  }

  @Post('recover/confirm')
  @ApiOperation({ summary: 'Consume a recovery link token and issue a controlled session' })
  async confirmRecovery(@Body() dto: RecoverConfirmDto) {
    return this.identity.confirmRecovery(dto.token, dto.device)
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiOkResponse({ description: 'Session revoked.' })
  async logout(@Body() body: { sessionId: string; token: string }) {
    return this.identity.revokeSession(body.sessionId, body.token)
  }

  @Get('session')
  @ApiOperation({ summary: 'Current session view: userId, emailVerified, authAdapter, expiresAt (S1)' })
  @ApiOkResponse({ description: 'Session view.', type: SessionViewDto })
  async getSession(@Headers('authorization') authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A valid session token is required.',
      })
    }
    return this.identity.getSessionViewByToken(token)
  }

  // ─── Demo Auth ───

  @Post('demo/register')
  @ApiOperation({ summary: 'Demo registration with auto-verified email (no verification required)' })
  @ApiOkResponse({ description: 'Demo user created; verified.' })
  async demoRegister(@Body() dto: RegisterEmailDto) {
    return this.identity.demoRegister(dto.email, dto.locale)
  }

  @Post('demo/login')
  @ApiOperation({ summary: 'Demo login with fixed credentials (no verification required)' })
  @ApiOkResponse({ description: 'Demo session issued.' })
  async demoLogin(@Body() dto: { email: string; type?: 'user' | 'admin' }) {
    return this.identity.demoLogin(dto.email, dto.type)
  }
}
