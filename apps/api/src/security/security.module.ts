import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdentityModule } from '../identity/identity.module'
import { Device } from '../identity/device.entity'
import { Session } from '../identity/session.entity'
import { AuditLog } from './audit-log.entity'
import { PasskeyCredential } from './passkey-credential.entity'
import { SecurityChallenge } from './security-challenge.entity'
import { SecurityController } from './security.controller'
import { SecurityService } from './security.service'
import { SessionAuthGuard } from './session-auth.guard'
import { TotpFactor } from './totp-factor.entity'

@Module({
  imports: [
    IdentityModule,
    TypeOrmModule.forFeature([Session, Device, TotpFactor, PasskeyCredential, SecurityChallenge, AuditLog]),
  ],
  controllers: [SecurityController],
  providers: [SecurityService, SessionAuthGuard],
  exports: [SecurityService, SessionAuthGuard],
})
export class SecurityModule {}
