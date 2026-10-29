import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SecurityModule } from '../security/security.module'
import { AiController } from './ai.controller'
import { AiModelClient } from './ai-model.client'
import { AiChatMessage } from './ai-message.entity'
import { AiChatSession } from './ai-session.entity'
import { AiService } from './ai.service'
import { CatalogModule } from '../catalog/catalog.module'
import { AiPlanningService } from './ai-planning.service'
import { AiPlanningController } from './ai-planning.controller'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { AiKnowledgeService } from './ai-knowledge.service'
import { AiPlatformKnowledgeService } from './ai-platform-knowledge.service'
import { AdminAiKnowledgeController, AiKnowledgeController } from './ai-knowledge.controller'
import { NotificationModule } from '../notification/notification.module'
import { AiCustomerToolsService } from './ai-customer-tools.service'
import { AiCustomerToolsController } from './ai-customer-tools.controller'
import { AiMandateService } from './ai-mandate.service'
import { AiAutomaticService } from './ai-automatic.service'
import { AiMandateController, AdminAiInvestmentController } from './ai-mandate.controller'
import { OrdersModule } from '../orders/orders.module'
import { PortfolioModule } from '../portfolio/portfolio.module'
import { ComplianceModule } from '../compliance/compliance.module'
import { AiNotificationDigestService } from './ai-notification-digest.service'
import { AiNotificationDigestController } from './ai-notification-digest.controller'
import { AiReadToolsService } from './ai-read-tools.service'
import { AiChatRateLimitGuard } from './ai-rate-limit.guard'
import { IdentityModule } from '../identity/identity.module'
import { LedgerModule } from '../ledger/ledger.module'
import { WalletModule } from '../wallet/wallet.module'
import { QuantModule } from '../quant/quant.module'
import { PredictionModule } from '../prediction/prediction.module'
import { ReferralModule } from '../referral/referral.module'
import { PolymarketModule } from '../polymarket/polymarket.module'
import { PlatformModule } from '../platform/platform.module'

@Module({
  imports: [TypeOrmModule.forFeature([AiChatSession, AiChatMessage]), SecurityModule, CatalogModule, AdminRbacModule, NotificationModule, OrdersModule, PortfolioModule, ComplianceModule, IdentityModule, LedgerModule, WalletModule, QuantModule, PredictionModule, ReferralModule, PolymarketModule, PlatformModule],
  controllers: [AiController, AiPlanningController, AdminAiKnowledgeController, AiKnowledgeController, AiCustomerToolsController, AiMandateController, AdminAiInvestmentController, AiNotificationDigestController],
  providers: [AiService, AiModelClient, AiPlanningService, AiKnowledgeService, AiPlatformKnowledgeService, AiCustomerToolsService, AiMandateService, AiAutomaticService, AiNotificationDigestService, AiReadToolsService, AiChatRateLimitGuard],
  exports: [AiService],
})
export class AiModule {}
