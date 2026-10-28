import { Module } from '@nestjs/common'
import { ComplianceModule } from '../compliance/compliance.module'
import { IdentityModule } from '../identity/identity.module'
import { LedgerModule } from '../ledger/ledger.module'
import { NotificationModule } from '../notification/notification.module'
import { OperationsModule } from '../operations/operations.module'
import { SecurityModule } from '../security/security.module'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { QuantInternalController } from './quant-internal.controller'
import { QuantSettlementService } from './quant-settlement.service'
import { QuantController } from './quant.controller'
import { QuantService } from './quant.service'

@Module({
  imports: [LedgerModule, NotificationModule, OperationsModule, IdentityModule, SecurityModule, ComplianceModule],
  controllers: [QuantController, QuantInternalController],
  providers: [QuantService, QuantSettlementService, InternalServiceGuard],
  exports: [QuantService, QuantSettlementService],
})
export class QuantModule {}
