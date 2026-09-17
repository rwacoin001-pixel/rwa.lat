import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminAuthController } from './admin-auth.controller'
import { AdminAuthService } from './admin-auth.service'
import { AdminSessionGuard } from './admin-session.guard'
import { validateAdminEnvironment } from './production-environment'
import { AdminPermissionGuard } from './admin-permission.guard'
import { AdminControlController } from './admin-control.controller'
import { AdminControlService } from './admin-control.service'
import { AdminStorageController } from './admin-storage.controller'
import { AdminStorageService } from './admin-storage.service'
import { AdminFundsOpsController, AdminWalletOpsController } from './admin-wallet-ops.controller'
import { AdminWalletOpsService } from './admin-wallet-ops.service'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateAdminEnvironment }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL,
      autoLoadEntities: false,
      synchronize: false,
      migrationsRun: false,
      entities: [],
      logging: false,
    }),
  ],
  controllers: [AdminController, AdminAuthController, AdminControlController, AdminStorageController, AdminWalletOpsController, AdminFundsOpsController],
  providers: [AdminService, AdminAuthService, AdminSessionGuard, AdminPermissionGuard, AdminControlService, AdminStorageService, AdminWalletOpsService],
})
export class AdminModule {
  static forTest(dataSource: DataSource): DynamicModule {
    return {
      module: AdminModule,
      imports: [
        TypeOrmModule.forRoot({
          ...dataSource.options,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
        }),
      ],
    }
  }
}
