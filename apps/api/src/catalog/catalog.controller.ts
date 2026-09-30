import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger'
import { CatalogService } from './catalog.service'
import { ListProductsQueryDto } from './catalog.dto'
import { CatalogError } from './catalog.errors'

class CatalogQuoteResponseDto {
  @ApiProperty()
  productId!: string

  @ApiProperty()
  unitPriceAtomicAmount!: string

  @ApiProperty({ description: 'Decimal places used by unitPriceAtomicAmount.' })
  unitPriceDecimals!: number

  @ApiProperty()
  currency!: string

  @ApiProperty()
  source!: string

  @ApiProperty()
  validUntil!: Date

  @ApiProperty()
  capturedAt!: Date

  @ApiProperty()
  stale!: boolean
}

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
    return this.catalog.getPublicProduct(id)
  }

  @Get('products/:id/disclosures')
  async listDisclosures(@Param('id') id: string) {
    await this.catalog.getPublicProduct(id)
    return this.catalog.listDisclosures(id)
  }

  @Get('products/:id/quote')
  @ApiOkResponse({ type: CatalogQuoteResponseDto })
  async getLatestQuote(@Param('id') id: string) {
    try {
      await this.catalog.getPublicProduct(id)
      return this.catalog.getLatestQuote(id)
    } catch (err) {
      if (err instanceof CatalogError) throw err
      throw err
    }
  }
}
