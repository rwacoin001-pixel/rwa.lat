import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AssetClass } from './asset-class.entity'
import { Product } from './product.entity'
import { DisclosureFile } from './disclosure-file.entity'
import { PriceQuote, PriceSnapshot } from './price.entity'
import {
  CatalogError,
  CATALOG_ERROR_CODES,
} from './catalog.errors'

export interface ProductView {
  id: string
  assetClassId: string
  version: number
  externalRef?: string
  displayName: string
  summary?: string
  assetCode: string
  assetDecimals: number
  network?: string
  minOrderAtomicAmount?: string
  maxOrderAtomicAmount?: string
  state: string
}

export interface QuoteView {
  productId: string
  unitPriceAtomicAmount: string
  currency: string
  source: string
  validUntil: Date
  capturedAt: Date
  stale: boolean
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(AssetClass)
    private readonly assetClassRepo: Repository<AssetClass>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(DisclosureFile)
    private readonly disclosureRepo: Repository<DisclosureFile>,
    @InjectRepository(PriceQuote)
    private readonly quoteRepo: Repository<PriceQuote>,
    @InjectRepository(PriceSnapshot)
    private readonly snapshotRepo: Repository<PriceSnapshot>,
  ) {}

  async listAssetClasses(): Promise<AssetClass[]> {
    return this.assetClassRepo.find({ order: { id: 'ASC' } })
  }

  async listProducts(assetClass?: string, state?: 'published' | 'suspended'): Promise<ProductView[]> {
    const where: Record<string, unknown> = {}
    if (assetClass) where.asset_class_id = assetClass
    if (state) where.state = state
    const products = await this.productRepo.find({ where, order: { published_at: 'DESC' } })
    return products.map((p) => this.toProductView(p))
  }

  async getProduct(id: string): Promise<ProductView> {
    const product = await this.productRepo.findOne({ where: { id } })
    if (!product) throw CatalogError.productNotFound(id)
    return this.toProductView(product)
  }

  async listDisclosures(productId: string): Promise<DisclosureFile[]> {
    const product = await this.productRepo.findOne({ where: { id: productId } })
    if (!product) throw CatalogError.productNotFound(productId)
    return this.disclosureRepo.find({
      where: { product_id: productId, state: 'active' },
      order: { published_at: 'DESC' },
    })
  }

  async getLatestQuote(productId: string, now: Date = new Date()): Promise<QuoteView> {
    const product = await this.productRepo.findOne({ where: { id: productId } })
    if (!product) throw CatalogError.productNotFound(productId)
    const quote = await this.quoteRepo.findOne({
      where: { product_id: productId },
      order: { valid_until: 'DESC' },
    })
    if (!quote) {
      throw new CatalogError(
        CATALOG_ERROR_CODES.QUOTE_STALE,
        `No quote available for product ${productId}`,
        409,
      )
    }
    const stale = quote.valid_until.getTime() <= now.getTime()
    return {
      productId,
      unitPriceAtomicAmount: quote.unit_price_atomic_amount,
      currency: quote.currency,
      source: quote.source,
      validUntil: quote.valid_until,
      capturedAt: quote.captured_at,
      stale,
    }
  }

  // 下单前置校验：产品必须 published 且报价新鲜。返回可下单的报价视图。
  async requireOrderableQuote(
    productId: string,
    now: Date = new Date(),
  ): Promise<QuoteView> {
    const product = await this.productRepo.findOne({ where: { id: productId } })
    if (!product) throw CatalogError.productNotFound(productId)
    if (product.state !== 'published') throw CatalogError.productNotPublished(productId)
    const quote = await this.getLatestQuote(productId, now)
    if (quote.stale) throw CatalogError.quoteStale(productId)
    return quote
  }

  async recordSnapshot(quote: QuoteView): Promise<void> {
    const stored = await this.quoteRepo.findOne({
      where: {
        product_id: quote.productId,
        source: quote.source,
        captured_at: quote.capturedAt,
      },
    })
    if (!stored) return
    await this.snapshotRepo.save(
      this.snapshotRepo.create({
        product_id: quote.productId,
        quote_id: stored.id,
        unit_price_atomic_amount: quote.unitPriceAtomicAmount,
        currency: quote.currency,
        captured_at: quote.capturedAt,
      }),
    )
  }

  private toProductView(p: Product): ProductView {
    return {
      id: p.id,
      assetClassId: p.asset_class_id,
      version: p.version,
      externalRef: p.external_ref,
      displayName: p.display_name,
      summary: p.summary,
      assetCode: p.asset_code,
      assetDecimals: p.asset_decimals,
      network: p.network,
      minOrderAtomicAmount: p.min_order_atomic_amount,
      maxOrderAtomicAmount: p.max_order_atomic_amount,
      state: p.state,
    }
  }
}
