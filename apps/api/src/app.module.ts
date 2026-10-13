import { ActivityModule } from './analytics/activity.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { ComplianceModule } from './compliance/compliance.module'
import { IdentityModule } from './identity/identity.module'
import { SecurityModule } from './security/security.module'
import { WalletModule } from './wallet/wallet.module'
import { validateApplicationEnvironment } from './config/production-environment'
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
import { OperationsModule } from './operations/operations.module'
import { MediaModule } from './media/media.module'
import { SummaryModule } from './summary/summary.module'
import { CommunityModule } from './community/community.module'
import { RwaMarketModule } from './rwa-market/rwa-market.module'
import { MarketContextModule } from './market-context/market-context.module'
import { RwaAnalysisModule } from './rwa-analysis/rwa-analysis.module'
import { AiModule } from './ai/ai.module'
import { TradingModule } from './trading/trading.module'
import { BasketModule } from './basket/basket.module'
import { PredictionModule } from './prediction/prediction.module'
import { AdminConsoleModule } from './admin-console/admin-console.module'
import { PlatformModule } from './platform/platform.module'
import { ContentModule } from './content/content.module'
import { GeneratedDocumentsModule } from './generated-documents/generated-documents.module'
import { PublicShareModule } from './sharing/public-share.module'
import { LegalModule } from './legal/legal.module'
import { ReferralHttpModule } from './referral/referral-http.module'
import { AdminUsersModule } from './admin-users/admin-users.module'
import { RobotsController } from './common/robots.controller'

@Module({
  controllers: [RobotsController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env'],
      validate: validateApplicationEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    IdentityModule,
    ComplianceModule,
    SecurityModule,
    WalletModule,
    ActivityModule,
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
    OperationsModule,
    MediaModule,
    SummaryModule,
    CommunityModule,
    RwaMarketModule,
    MarketContextModule,
    RwaAnalysisModule,
    AiModule,
    TradingModule,
    BasketModule,
    PredictionModule,
    AdminConsoleModule,
    PlatformModule,
    ContentModule,
    GeneratedDocumentsModule,
    PublicShareModule,
    LegalModule,
    ReferralHttpModule,
    AdminUsersModule,
  ],
})
export class AppModule {}

