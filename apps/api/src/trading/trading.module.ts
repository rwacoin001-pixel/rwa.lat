import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SecurityModule } from '../security/security.module'
import { ComplianceModule } from '../compliance/compliance.module'
import { TradingController } from './trading.controller'
import { TradingFill, TradingOrder, TradingPair } from './trading.entities'
import { TradingService } from './trading.service'

@Module({
  imports: [TypeOrmModule.forFeature([TradingPair, TradingOrder, TradingFill]), SecurityModule, ComplianceModule],
  controllers: [TradingController],
  providers: [TradingService],
  exports: [TradingService],
})
export class TradingModule {}
