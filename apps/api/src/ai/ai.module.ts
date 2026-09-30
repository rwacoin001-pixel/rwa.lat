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

@Module({
  imports: [TypeOrmModule.forFeature([AiChatSession, AiChatMessage]), SecurityModule, CatalogModule, AdminRbacModule, NotificationModule, OrdersModule, PortfolioModule, ComplianceModule],
  controllers: [AiController, AiPlanningController, AdminAiKnowledgeController, AiKnowledgeController, AiCustomerToolsController, AiMandateController, AdminAiInvestmentController],
  providers: [AiService, AiModelClient, AiPlanningService, AiKnowledgeService, AiCustomerToolsService, AiMandateService, AiAutomaticService],
  exports: [AiService],
})
export class AiModule {}
