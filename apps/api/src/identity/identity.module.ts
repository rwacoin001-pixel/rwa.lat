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
import { IdentityDeliveryService } from './identity-delivery.service'
import { OAuthProviderService } from './oauth-provider.service'

@Module({
  imports: [TypeOrmModule.forFeature([User, LoginIdentity, Device, Session, IdentityOneTimeToken])],
  controllers: [IdentityController],
  providers: [IdentityService, IdentityCrypto, IdentityDeliveryService, OAuthProviderService],
  exports: [IdentityService, IdentityCrypto],
})
export class IdentityModule {}
