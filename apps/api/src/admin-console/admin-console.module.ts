import { Module } from '@nestjs/common'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { RwaMarketModule } from '../rwa-market/rwa-market.module'
import { AdminConsoleController } from './admin-console.controller'
import { AdminConsoleService } from './admin-console.service'

/** 管理台运营数据域（只读）：订单/KYC/风控/适当性/收益/结算/资产/AI/预测市场/网络/充值。 */
@Module({
  imports: [AdminRbacModule, RwaMarketModule],
  controllers: [AdminConsoleController],
  providers: [AdminConsoleService],
})
export class AdminConsoleModule {}
