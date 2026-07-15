import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CatalogModule } from '../catalog/catalog.module'
import { IdentityModule } from '../identity/identity.module'
import { Session } from '../identity/session.entity'
import { NotificationModule } from '../notification/notification.module'
import { SecurityModule } from '../security/security.module'
import { DemoYieldController, YieldController } from './yield.controller'
import { YieldService } from './yield.service'

@Module({
  imports: [CatalogModule, IdentityModule, NotificationModule, SecurityModule, TypeOrmModule.forFeature([Session])],
  controllers: [YieldController, DemoYieldController],
  providers: [YieldService],
  exports: [YieldService],
})
export class YieldModule {}
