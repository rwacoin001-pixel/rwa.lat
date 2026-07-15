import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CatalogService } from '../../src/catalog/catalog.service'
import { AssetClass } from '../../src/catalog/asset-class.entity'
import { Product } from '../../src/catalog/product.entity'
import { DisclosureFile } from '../../src/catalog/disclosure-file.entity'
import { PriceQuote, PriceSnapshot } from '../../src/catalog/price.entity'
import { CatalogError, CATALOG_ERROR_CODES } from '../../src/catalog/catalog.errors'

const now = () => new Date()

describe('CatalogService (unit)', () => {
  let service: CatalogService
  let productRepo: Repository<Product>
  let quoteRepo: Repository<PriceQuote>

  const mockRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
  })

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: getRepositoryToken(AssetClass), useValue: mockRepo() },
        { provide: getRepositoryToken(Product), useValue: mockRepo() },
        { provide: getRepositoryToken(DisclosureFile), useValue: mockRepo() },
        { provide: getRepositoryToken(PriceQuote), useValue: mockRepo() },
        { provide: getRepositoryToken(PriceSnapshot), useValue: mockRepo() },
      ],
    }).compile()
    service = module.get(CatalogService)
    productRepo = module.get(getRepositoryToken(Product))
    quoteRepo = module.get(getRepositoryToken(PriceQuote))
  })

  it('getProduct throws when product missing', async () => {
    productRepo.findOne = jest.fn().mockResolvedValue(undefined)
    await expect(service.getProduct('missing')).rejects.toMatchObject({
      code: CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND,
    })
  })

  it('getLatestQuote marks stale when valid_until passed', async () => {
    productRepo.findOne = jest.fn().mockResolvedValue({ id: 'p1' } as Product)
    const past = new Date(Date.now() - 1000)
    quoteRepo.findOne = jest
      .fn()
      .mockResolvedValue({
        product_id: 'p1',
        unit_price_atomic_amount: '100',
        currency: 'USD',
        source: 'seed',
        valid_until: past,
        captured_at: new Date(Date.now() - 5000),
      } as PriceQuote)
    const q = await service.getLatestQuote('p1', now())
    expect(q.stale).toBe(true)
  })

  it('getLatestQuote marks fresh when valid_until in future', async () => {
    productRepo.findOne = jest.fn().mockResolvedValue({ id: 'p1' } as Product)
    const future = new Date(Date.now() + 60000)
    quoteRepo.findOne = jest
      .fn()
      .mockResolvedValue({
        product_id: 'p1',
        unit_price_atomic_amount: '100',
        currency: 'USD',
        source: 'seed',
        valid_until: future,
        captured_at: new Date(),
      } as PriceQuote)
    const q = await service.getLatestQuote('p1', now())
    expect(q.stale).toBe(false)
  })

  it('requireOrderableQuote rejects stale quote (data expiration blocks order)', async () => {
    productRepo.findOne = jest.fn().mockResolvedValue({ id: 'p1', state: 'published' } as Product)
    quoteRepo.findOne = jest
      .fn()
      .mockResolvedValue({
        product_id: 'p1',
        unit_price_atomic_amount: '100',
        currency: 'USD',
        source: 'seed',
        valid_until: new Date(Date.now() - 1000),
        captured_at: new Date(Date.now() - 5000),
      } as PriceQuote)
    await expect(service.requireOrderableQuote('p1', now())).rejects.toBeInstanceOf(CatalogError)
    await expect(service.requireOrderableQuote('p1', now())).rejects.toMatchObject({
      code: CATALOG_ERROR_CODES.QUOTE_STALE,
    })
  })

  it('requireOrderableQuote rejects unpublished product', async () => {
    productRepo.findOne = jest.fn().mockResolvedValue({ id: 'p1', state: 'draft' } as Product)
    await expect(service.requireOrderableQuote('p1', now())).rejects.toMatchObject({
      code: CATALOG_ERROR_CODES.PRODUCT_NOT_PUBLISHED,
    })
  })
})
