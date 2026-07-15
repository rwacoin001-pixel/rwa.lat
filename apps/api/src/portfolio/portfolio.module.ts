import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PortfolioService } from './portfolio.service'
import { PortfolioController } from './portfolio.controller'
import { PositionSnapshot, Redemption } from './portfolio.entities'
import { LedgerModule } from '../ledger/ledger.module'
import { CatalogModule } from '../catalog/catalog.module'
import { SecurityModule } from '../security/security.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([PositionSnapshot, Redemption]),
    LedgerModule,
    CatalogModule,
    SecurityModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
