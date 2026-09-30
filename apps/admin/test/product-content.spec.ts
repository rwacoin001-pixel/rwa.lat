import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { AdminControlService } from '../src/admin-control.service'
import { SavePlatformDto } from '../src/admin-platform.dto'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

describe('Operator-managed product content', () => {
  const admin = '00000000-0000-4000-8000-000000000001'
  function setup() {
    const audit = jest.fn().mockResolvedValue([])
    const service = new AdminControlService({ query: audit } as unknown as DataSource, new ConfigService({}))
    jest.spyOn(service, 'getProduct').mockResolvedValue({ id: 'product', externalRef: 'keep', network: 'tron', minOrderAtomicAmount: '10', maxOrderAtomicAmount: '100' })
    const query = jest.spyOn(service as any, 'query').mockResolvedValue([])
    return { service, query }
  }
  it('a risk-only update preserves identifiers, network and amount limits', async () => {
    const { service, query } = setup()
    await service.updateProduct('product', { riskDisclosure: { riskLevel: 'R3' } }, admin)
    const sql = String(query.mock.calls.find(c => String(c[0]).startsWith('UPDATE app.products'))?.[0])
    expect(sql).toContain('risk_disclosure_json =')
    for (const column of ['external_ref', 'network', 'min_order_atomic_amount', 'max_order_atomic_amount']) expect(sql).not.toContain(`${column} =`)
  })
  it('rejects private or unscanned cover references before saving', async () => {
    const { service, query } = setup()
    await expect(service.updateProduct('product', { coverStorageRef: 'rwa-kyc/identity.png' }, admin)).rejects.toThrow()
    await expect(service.updateProduct('product', { coverStorageRef: 'rwa-assets/unchecked.png' }, admin)).rejects.toThrow()
    expect(query.mock.calls.some(c => String(c[0]).startsWith('UPDATE app.products'))).toBe(false)
  })
  it('supports explicitly removing a cover without clearing other fields', async () => {
    const { service, query } = setup()
    await service.updateProduct('product', { coverStorageRef: null }, admin)
    expect(query.mock.calls[0][0]).toContain('cover_storage_ref = $1')
    expect((query.mock.calls[0][1] as unknown[])[0]).toBeNull()
  })
  it('requires a real first payment date for a product-wide yield calendar', async () => {
    const { service, query } = setup()
    await expect(service.updateProduct('product', { yieldTerms: {
      payoutFrequency: 'monthly', scheduleMode: 'product_calendar', firstExpectedPaymentDate: '2026-02-31', scheduleTimezone: 'UTC',
    } }, admin)).rejects.toThrow('首次预计支付日')
    await expect(service.updateProduct('product', { yieldTerms: {
      payoutFrequency: 'monthly', scheduleMode: 'product_calendar', scheduleTimezone: 'UTC',
    } }, admin)).rejects.toThrow('必须填写首次预计支付日')
    expect(query.mock.calls.some(c => String(c[0]).startsWith('UPDATE app.products'))).toBe(false)
  })
  it('accepts a valid product calendar and record-date offset', async () => {
    const { service, query } = setup()
    await service.updateProduct('product', { yieldTerms: {
      rateType: 'fixed', annualRateBps: 800, payoutFrequency: 'quarterly', scheduleMode: 'product_calendar',
      firstExpectedPaymentDate: '2026-12-31', recordDateOffsetDays: 7, scheduleTimezone: 'Asia/Shanghai',
    } }, admin)
    expect(query.mock.calls.some(c => String(c[0]).startsWith('UPDATE app.products'))).toBe(true)
  })
  it('rejects missing platform content and malformed region lists', async () => {
    expect((await validate(plainToInstance(SavePlatformDto, { expectedRevision: 0 }))).length).toBeGreaterThan(0)
    expect((await validate(plainToInstance(SavePlatformDto, { expectedRevision: 0, content: { allowedRegions: ['ALL'] } }))).length).toBeGreaterThan(0)
  })
  it('accepts only HTTPS official channel links', async () => {
    const base = { expectedRevision: 1, content: { legalName: 'RWA LAT Ltd', registrationNumber: 'REG-1', jurisdiction: 'SG', address: 'Singapore', supportEmail: 'support@example.com', description: '', allowedRegions: ['SG'], investorTypes: ['professional'], documents: [] } }
    expect((await validate(plainToInstance(SavePlatformDto, { ...base, content: { ...base.content, officialChannels: [{ kind: 'website', label: 'Website', url: 'javascript:alert(1)', note: '' }] } }))).length).toBeGreaterThan(0)
    expect((await validate(plainToInstance(SavePlatformDto, { ...base, content: { ...base.content, officialChannels: [{ kind: 'website', label: 'Website', url: 'https://rwa.example', note: '' }] } }))).length).toBe(0)
  })
  it('rolls back the old disclosure replacement if the new file cannot be inserted', async () => {
    const { service } = setup()
    jest.spyOn(service as any, 'assertPublicFile').mockResolvedValue({ checksum_sha256: 'a'.repeat(64) })
    const failure = new Error('insert failed')
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO app.disclosure_files')) throw failure
        return { rows: [] }
      }),
      release: jest.fn(),
    }
    ;(service as any).core = { connect: jest.fn().mockResolvedValue(client) }
    await expect(service.addDisclosure('product', {
      kind: 'risk_disclosure', locale: 'en', title: 'Updated disclosure',
      storageRef: 'rwa-assets/document.pdf', contentHash: 'a'.repeat(64),
    } as any, admin)).rejects.toThrow(failure)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.query).not.toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalledTimes(1)
  })
})
