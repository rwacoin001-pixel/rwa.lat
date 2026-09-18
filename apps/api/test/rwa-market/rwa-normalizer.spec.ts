import {
  dec,
  mapCmcAssetType,
  normalizeCmcAsset,
  normalizeCmcIssuer,
  normalizeCmcMetrics,
  parseDate,
  slugify,
} from '../../src/rwa-market/normalizers/rwa.normalizer'

describe('rwa normalizer', () => {
  it('maps CMC asset types to RWA.LAT asset classes', () => {
    expect(mapCmcAssetType('commodity')).toBe('commodity')
    expect(mapCmcAssetType('stock')).toBe('equity')
    expect(mapCmcAssetType('ETF')).toBe('fund')
    expect(mapCmcAssetType('Government Security')).toBe('bond')
    expect(mapCmcAssetType('government-security')).toBe('bond')
    expect(mapCmcAssetType('real estate')).toBe('real_estate')
    expect(mapCmcAssetType('treasury')).toBe('treasury')
    expect(mapCmcAssetType('something-new')).toBe('other')
    expect(mapCmcAssetType(null)).toBe('other')
    expect(mapCmcAssetType(undefined)).toBe('other')
  })

  it('slugifies fallback names', () => {
    expect(slugify('Apple Inc. — Tokenized')).toBe('apple-inc-tokenized')
    expect(slugify('  --Weird--  ')).toBe('weird')
    expect(slugify('')).toBe('')
  })

  it('converts numbers to financial strings with 12-decimal rounding (no float noise)', () => {
    expect(dec(1.05)).toBe('1.050000000000')
    expect(dec(0)).toBe('0.000000000000')
    expect(dec(null)).toBeNull()
    expect(dec(undefined)).toBeNull()
    expect(dec(Number.NaN)).toBeNull()
    expect(Number(dec(4381.232069238328))).toBeCloseTo(4381.232069238328, 9)
  })

  it('normalizes a CMC asset with info detail', () => {
    const asset = normalizeCmcAsset(
      {
        name: 'Gold',
        symbol: 'GOLD',
        slug: 'gold',
        rwa_id: 1,
        asset_type: 'commodity',
        rwa_rank: 1,
        has_tokens: true,
      },
      {
        name: 'Gold',
        slug: 'gold',
        website: 'https://example.com/gold',
        about: { description: '  Gold is a safe haven.  ' },
      },
    )
    expect(asset).toEqual({
      externalId: '1',
      externalSlug: 'gold',
      name: 'Gold',
      symbol: 'GOLD',
      assetClass: 'commodity',
      rawAssetType: 'commodity',
      description: 'Gold is a safe haven.',
      websiteUrl: 'https://example.com/gold',
      logoUrl: null,
      rank: 1,
      isTokenized: true,
      issuerName: null,
    })
  })

  it('propagates issuer name from the token list', () => {
    const asset = normalizeCmcAsset({
      name: 'Nvidia',
      slug: 'nvidia',
      rwa_id: 2,
      asset_type: 'stock',
      tokens: [{ symbol: 'bNVDA', name: 'Backed NVIDIA', crypto_id: 1, issuer_id: 'x1', issuer_name: 'Backed Assets' }],
    })
    expect(asset.issuerName).toBe('Backed Assets')
    expect(asset.assetClass).toBe('equity')
  })

  it('falls back to a slug-based external id when rwa_id is missing', () => {
    const asset = normalizeCmcAsset({ name: 'Alphabet Inc.', slug: 'alphabet-inc', rwa_id: null, asset_type: 'stock' })
    expect(asset.externalId).toBe('slug:alphabet-inc')
    const metric = normalizeCmcMetrics({ name: 'Alphabet Inc.', slug: 'alphabet-inc', rwa_id: null })
    expect(metric.externalId).toBe('slug:alphabet-inc')
  })

  it('normalizes metrics including tokens and dates', () => {
    const metric = normalizeCmcMetrics({
      name: 'Gold',
      slug: 'gold',
      rwa_id: 1,
      average_tokenized_price: 4381.23,
      tokenized_market_cap: 4725233368.13,
      tokenized_volume_24h: 437481537.59,
      last_updated: '2026-09-18T08:39:05.000Z',
      tokens: [{ symbol: 'PAXG', name: 'PAX Gold', crypto_id: 4705, issuer_id: 'x1', issuer_name: 'Paxos', price: 4382.5 }],
    })
    expect(metric.externalId).toBe('1')
    expect(Number(metric.priceUsd)).toBeCloseTo(4381.23, 6)
    expect(metric.dataTimestamp?.toISOString()).toBe('2026-09-18T08:39:05.000Z')
    expect(metric.tokens).toHaveLength(1)
    expect(metric.tokens[0]).toMatchObject({ symbol: 'PAXG', cryptoId: 4705, issuerName: 'Paxos' })
  })

  it('normalizes issuers and parses bad dates defensively', () => {
    const issuer = normalizeCmcIssuer({ name: 'Backed Assets', issuer_id: 'abc', num_tokens: 1176, website: 'https://assets.backed.fi/' })
    expect(issuer).toMatchObject({ externalId: 'abc', slug: 'backed-assets', tokenCount: 1176 })
    expect(parseDate('nonsense')).toBeNull()
    expect(parseDate(null)).toBeNull()
    expect(parseDate('2026-09-18T08:39:05.000Z')).toBeInstanceOf(Date)
  })
})
