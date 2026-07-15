import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdentityModule } from '../identity/identity.module'
import { SecurityModule } from '../security/security.module'
import { Session } from '../identity/session.entity'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { AdminLedgerController, LedgerCallbackController, LedgerController } from './ledger.controller'
import { LedgerService } from './ledger.service'
import { CustodyWebhookVerifier } from '../wallet/custody-webhook.verifier'

@Module({
  imports: [IdentityModule, SecurityModule, AdminRbacModule, TypeOrmModule.forFeature([Session])],
  controllers: [LedgerController, LedgerCallbackController, AdminLedgerController],
  providers: [LedgerService, CustodyWebhookVerifier],
  exports: [LedgerService],
})
export class LedgerModule {}
