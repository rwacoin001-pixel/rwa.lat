import { BadRequestException, Body, Controller, Get, Header, Headers, Param, Post, UnauthorizedException } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IdentityService } from './identity.service'
import { RegisterEmailDto } from './dto/register-email.dto'
import { PasswordLoginDto, PasswordManageDto, ChangeEmailDto, AuthFlowCompleteDto, AuthFlowTokenDto, AuthFlowEmailDto } from './dto/password-auth.dto'
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
import { EmailBindingStartDto, EmailBindingSendDto, EmailBindingTokenDto, EmailBindingCompleteDto } from './dto/email-binding.dto'
import { ConfirmEmailCodeDto, EmailCodeChallengeDto, EmailLookupDto, EmailLookupResultDto, RequestEmailCodeDto } from './dto/email-code.dto'
import { AppHandoffRedeemDto, AppHandoffStartDto } from './dto/app-handoff.dto'

@ApiTags('identity')
@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService, private readonly emailCodes: EmailCodeService) {}

  private sessionToken(authorization?: string): string {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Sign in first.' })
    return token
  }

  @Post('email/bind/start')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Start email binding for the current signed-in account' })
  startEmailBinding(@Headers('authorization') authorization: string | undefined, @Body() dto: EmailBindingStartDto) {
    return this.identity.startEmailBinding(this.sessionToken(authorization), dto.userId)
  }

  @Post('email/bind/send')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Send a binding code without switching the signed-in account' })
  sendEmailBinding(@Headers('authorization') authorization: string | undefined, @Body() dto: EmailBindingSendDto) {
    return this.identity.sendEmailBinding(this.sessionToken(authorization), dto.continuationToken, dto.email, dto.userId)
  }

  @Post('email/bind/resend')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Resend the current signed-in account email binding code' })
  resendEmailBinding(@Headers('authorization') authorization: string | undefined, @Body() dto: EmailBindingTokenDto) {
    return this.identity.resendEmailBinding(this.sessionToken(authorization), dto.continuationToken, dto.userId)
  }

  @Post('email/bind/complete')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Complete email binding while preserving the current session' })
  completeEmailBinding(@Headers('authorization') authorization: string | undefined, @Body() dto: EmailBindingCompleteDto) {
    if (!dto.code) throw new BadRequestException({ code: 'AUTH_CODE_INVALID', message: 'Enter a six-digit code.' })
    return this.identity.completeEmailBinding(this.sessionToken(authorization), dto.continuationToken, dto.code, dto.userId)
  }

  @Post('login/password')
  @ApiOperation({ summary: 'Verify password and require account second-factor verification' })
  loginPassword(@Body() dto: PasswordLoginDto) { return this.identity.loginPassword(dto.email, dto.password, dto.device) }

  @Post('flow/complete')
  @ApiOperation({ summary: 'Complete a server-bound authentication step' })
  completeFlow(@Body() dto: AuthFlowCompleteDto) { return this.identity.completeAuthFlow(dto as Parameters<IdentityService['completeAuthFlow']>[0]) }

  @Post('flow/resend')
  @ApiOperation({ summary: 'Resend the email code for a pending authentication step' })
  resendFlow(@Body() dto: AuthFlowTokenDto) { return this.identity.resendAuthFlow(dto.continuationToken) }

  @Post('flow/email')
  @ApiOperation({ summary: 'Attach a sign-in email to a pending verification flow and send its code' })
  flowEmail(@Body() dto: AuthFlowEmailDto) { return this.identity.bindAuthFlowEmail(dto.continuationToken, dto.email) }

  @Post('password/manage')
  @ApiOperation({ summary: 'Begin verified password setup or change for the signed-in account' })
  managePassword(@Headers('authorization') authorization: string | undefined, @Body() dto: PasswordManageDto) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Sign in first.' })
    return this.identity.managePassword(token, dto.device, dto.email, dto.reauthentication)
  }

  @Post('email/change')
  @ApiOperation({ summary: 'Require recent verification and send a code to the new sign-in email' })
  changeEmail(@Headers('authorization') authorization: string | undefined, @Body() dto: ChangeEmailDto) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new UnauthorizedException({ code: 'AUTH_SESSION_REQUIRED', message: 'Authentication required.' })
    return this.identity.changeEmail(token, dto.email, dto.reauthentication)
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
    if (provider !== 'google' && provider !== 'github' && provider !== 'x') {
      throw new BadRequestException({ code: 'OAUTH_PROVIDER_UNSUPPORTED', message: 'Unsupported OAuth provider' })
    }
    return this.identity.exchangeOAuthCode(provider, dto.code, dto.state, dto.redirectUri, dto.device)
  }

  @Post('oauth/:provider/start')
  @ApiOperation({ summary: 'Create a server-bound Google OAuth 2 or X OAuth 1.0a authorization URL' })
  async oauthStart(@Param('provider') provider: string, @Body() dto?: OAuthStartDto) {
    if (provider !== 'google' && provider !== 'github' && provider !== 'x') {
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

  @Post('app-handoff')
  @ApiOperation({ summary: 'Signed-in browser: one-time code that signs the Android app in (PKCE-bound, 2 minutes)' })
  async startAppHandoff(@Body() dto: AppHandoffStartDto, @Headers('authorization') authorization?: string) {
    return this.identity.startAppHandoff(this.sessionToken(authorization), dto.challenge)
  }

  @Post('app-handoff/redeem')
  @ApiOperation({ summary: 'Android app: redeem the browser code with its PKCE verifier for its own session' })
  async redeemAppHandoff(@Body() dto: AppHandoffRedeemDto) {
    return this.identity.redeemAppHandoff(dto.code, dto.verifier)
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
