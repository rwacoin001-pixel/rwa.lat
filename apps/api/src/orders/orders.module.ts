import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CatalogModule } from '../catalog/catalog.module'
import { ComplianceModule } from '../compliance/compliance.module'
import { IdentityModule } from '../identity/identity.module'
import { Session } from '../identity/session.entity'
import { NotificationModule } from '../notification/notification.module'
import { SecurityModule } from '../security/security.module'
import { DemoOrdersController, OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'

@Module({
  imports: [CatalogModule, ComplianceModule, IdentityModule, NotificationModule, SecurityModule, TypeOrmModule.forFeature([Session])],
  controllers: [OrdersController, DemoOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
