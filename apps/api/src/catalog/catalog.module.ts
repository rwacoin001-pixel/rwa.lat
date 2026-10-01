import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AssetClass } from './asset-class.entity'
import { Product } from './product.entity'
import { DisclosureFile } from './disclosure-file.entity'
import { PriceQuote, PriceSnapshot } from './price.entity'
import { CatalogService } from './catalog.service'
import { CatalogController } from './catalog.controller'
import { AutomaticQuoteWorker } from './automatic-quote.worker'
import { FreeContractPriceClient } from './free-contract-price.client'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetClass,
      Product,
      DisclosureFile,
      PriceQuote,
      PriceSnapshot,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService, AutomaticQuoteWorker, FreeContractPriceClient],
  exports: [CatalogService],
})
export class CatalogModule {}
