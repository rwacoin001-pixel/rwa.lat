import { Controller, Get, Param, Query } from '@nestjs/common'
import { CatalogService } from './catalog.service'
import { ListProductsQueryDto } from './catalog.dto'
import { CatalogError } from './catalog.errors'

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('asset-classes')
  listAssetClasses() {
    return this.catalog.listAssetClasses()
  }

  @Get('products')
  listProducts(@Query() query: ListProductsQueryDto) {
    return this.catalog.listProducts(query.assetClass, query.state)
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.catalog.getProduct(id)
  }

  @Get('products/:id/disclosures')
  listDisclosures(@Param('id') id: string) {
    return this.catalog.listDisclosures(id)
  }

  @Get('products/:id/quote')
  getLatestQuote(@Param('id') id: string) {
    try {
      return this.catalog.getLatestQuote(id)
    } catch (err) {
      if (err instanceof CatalogError) throw err
      throw err
    }
  }
}
