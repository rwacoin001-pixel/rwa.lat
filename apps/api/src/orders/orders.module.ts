import { Module } from '@nestjs/common'
import { GeneratedDocumentsModule } from '../generated-documents/generated-documents.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CatalogModule } from '../catalog/catalog.module'
import { ComplianceModule } from '../compliance/compliance.module'
import { IdentityModule } from '../identity/identity.module'
import { Session } from '../identity/session.entity'
import { NotificationModule } from '../notification/notification.module'
import { SecurityModule } from '../security/security.module'
import { OperationsModule } from '../operations/operations.module'
import { DemoOrdersController, OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { ManualSettlementController } from './manual-settlement.controller'
import { ManualSettlementService } from './manual-settlement.service'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { RecurringController } from './recurring.controller'
import { RecurringService } from './recurring.service'

@Module({
  imports: [GeneratedDocumentsModule, CatalogModule, ComplianceModule, IdentityModule, NotificationModule, SecurityModule, OperationsModule, TypeOrmModule.forFeature([Session])],
  controllers: [OrdersController, DemoOrdersController, ManualSettlementController, RecurringController],
  providers: [OrdersService, ManualSettlementService, InternalServiceGuard, RecurringService],
  exports: [OrdersService],
})
export class OrdersModule {}

