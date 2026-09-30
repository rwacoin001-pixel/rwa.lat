import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdentityController } from './identity.controller'
import { IdentityCrypto } from './identity-crypto.service'
import { IdentityService } from './identity.service'
import { Device } from './device.entity'
import { LoginIdentity } from './login-identity.entity'
import { Session } from './session.entity'
import { User } from './user.entity'
import { IdentityOneTimeToken } from './identity-one-time-token.entity'
import { IdentityPasskeyChallenge } from './identity-passkey-challenge.entity'
import { PasskeyCredential } from '../security/passkey-credential.entity'
import { IdentityDeliveryService } from './identity-delivery.service'
import { OAuthProviderService } from './oauth-provider.service'
import { EmailCodeService } from './email-code.service'
import { ReferralModule } from '../referral/referral.module'

@Module({
  imports: [ReferralModule, TypeOrmModule.forFeature([User, LoginIdentity, Device, Session, IdentityOneTimeToken, IdentityPasskeyChallenge, PasskeyCredential])],
  controllers: [IdentityController],
  providers: [IdentityService, IdentityCrypto, IdentityDeliveryService, OAuthProviderService, EmailCodeService],
  exports: [IdentityService, IdentityCrypto],
})
export class IdentityModule {}
