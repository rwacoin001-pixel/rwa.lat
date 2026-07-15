import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { ComplianceModule } from './compliance/compliance.module'
import { IdentityModule } from './identity/identity.module'
import { SecurityModule } from './security/security.module'
import { WalletModule } from './wallet/wallet.module'
import { validateEnvironment } from './config/production-environment'
import { LedgerModule } from './ledger/ledger.module'
import { CatalogModule } from './catalog/catalog.module'
import { NotificationModule } from './notification/notification.module'
import { PortfolioModule } from './portfolio/portfolio.module'
import { AdminRbacModule } from './admin-rbac/admin-rbac.module'
import { DataGovernanceModule } from './data-governance/data-governance.module'
import { JobQueueModule } from './job-queue/job-queue.module'
import { ObjectStorageModule } from './object-storage/object-storage.module'
import { ObservabilityModule } from './observability/observability.module'
import { OrdersModule } from './orders/orders.module'
import { YieldModule } from './yield/yield.module'
import { PolymarketModule } from './polymarket/polymarket.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    IdentityModule,
    ComplianceModule,
    SecurityModule,
    WalletModule,
    LedgerModule,
    CatalogModule,
    NotificationModule,
    PortfolioModule,
    AdminRbacModule,
    DataGovernanceModule,
    JobQueueModule,
    ObjectStorageModule,
    ObservabilityModule,
    OrdersModule,
    YieldModule,
    PolymarketModule,
  ],
})
export class AppModule {}
