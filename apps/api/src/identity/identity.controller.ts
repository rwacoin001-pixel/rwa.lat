import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IdentityService } from './identity.service'
import { RegisterEmailDto } from './dto/register-email.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { RecoverDto } from './dto/recover.dto'
import { RecoverConfirmDto } from './dto/recover-confirm.dto'
import { OAuthCallbackDto } from './dto/oauth-callback.dto'
import { WalletChallengeDto, WalletVerifyDto } from './dto/wallet.dto'

@ApiTags('identity')
@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register/email')
  @ApiOperation({ summary: 'Register a new account with an email address' })
  @ApiCreatedResponse({ description: 'Account created; email verification required.' })
  async registerEmail(@Body() dto: RegisterEmailDto) {
    return this.identity.registerEmail(dto.email, dto.locale)
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify an email using the verification token' })
  @ApiOkResponse({ description: 'Email verified.' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.identity.verifyEmail(dto.token, dto.device)
  }

  @Post('wallet/challenge')
  @ApiOperation({ summary: 'Issue a single-use nonce for wallet signature' })
  @ApiOkResponse({ description: 'Challenge nonce issued.' })
  async walletChallenge(@Body() dto: WalletChallengeDto) {
    return this.identity.createWalletChallenge(dto.address)
  }

  @Post('wallet/verify')
  @ApiOperation({ summary: 'Verify wallet signature and open a session' })
  @ApiOkResponse({ description: 'Wallet authenticated; session issued.' })
  async walletVerify(@Body() dto: WalletVerifyDto) {
    return this.identity.verifyWalletSignature(dto.address, dto.signature, dto.nonce, dto.device)
  }

  @Post('oauth/:provider')
  @ApiOperation({ summary: 'Exchange a verified Google / X authorization code' })
  @ApiOkResponse({ description: 'OAuth identity resolved after server-side provider verification.' })
  async oauth(@Param('provider') provider: string, @Body() dto: OAuthCallbackDto) {
    if (provider !== 'google' && provider !== 'x') {
      throw new BadRequestException('Unsupported OAuth provider')
    }
    return this.identity.exchangeOAuthCode(provider, dto.code, dto.state, dto.redirectUri, dto.device)
  }

  @Post('oauth/:provider/start')
  @ApiOperation({ summary: 'Create a server-bound Google / X OAuth authorization URL with PKCE' })
  async oauthStart(@Param('provider') provider: string) {
    if (provider !== 'google' && provider !== 'x') {
      throw new BadRequestException('Unsupported OAuth provider')
    }
    return this.identity.beginOAuth(provider)
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
