import { priceToAtomic, verifiedAutomaticQuote, QuoteBinding, ContractTokenQuote, automaticQuoteSource, contractCoin } from '../../src/catalog/automatic-quote'

const now = new Date('2026-10-02T00:00:00Z')
const binding: QuoteBinding = { revision:1,bindingId:'a',enabled:true,issuerName:'Verified issuer',tokenName:'Actual issued token',tokenSymbol:'REAL',chain:'ethereum',contractAddress:'0x1234567890123456789012345678901234567890' }
const quote = (): ContractTokenQuote => ({coin:contractCoin(binding),symbol:'REAL',price:'12.345678901234567891',timestamp:Date.parse('2026-10-01T23:56:00Z')/1000,confidence:0.99})

describe('Exact-token automatic quotes', () => {
  it('preserves 18-decimal price and derives expiration from the source timestamp', () => {
    expect(verifiedAutomaticQuote(binding,quote(),now)).toEqual({atomic:'12345678901234567891',capturedAt:new Date('2026-10-01T23:56:00Z'),validUntil:new Date('2026-10-02T00:06:00Z'),source:automaticQuoteSource(binding)})
  })
  it.each(['coin','symbol','confidence'] as const)('rejects a mismatched %s instead of guessing the underlying', key => {
    const token = quote()
    Object.assign(token,{[key]:key==='confidence'?0.2:'Wrong'})
    expect(verifiedAutomaticQuote(binding,token,now)).toBeNull()
  })
  it.each(['2026-10-01T23:50:00Z','2026-10-02T00:00:01Z','invalid'])('rejects expired, future or invalid source time %s', timestamp => {
    const token=quote(); token.timestamp=Date.parse(timestamp)/1000
    expect(verifiedAutomaticQuote(binding,token,now)).toBeNull()
  })
  it('does not substitute another contract, chain or a disabled binding', () => {
    expect(verifiedAutomaticQuote({...binding,chain:'arbitrum'},quote(),now)).toBeNull()
    expect(verifiedAutomaticQuote({...binding,contractAddress:'0x9999999999999999999999999999999999999999'},quote(),now)).toBeNull()
    expect(verifiedAutomaticQuote({...binding,enabled:false},quote(),now)).toBeNull()
  })
  it('normalizes only EVM address case and preserves non-EVM identity', () => {
    expect(contractCoin({chain:'ethereum',contractAddress:'0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD'})).toBe('ethereum:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
    expect(contractCoin({chain:'solana',contractAddress:'AbCdEfGH12345678901234567890'})).toBe('solana:AbCdEfGH12345678901234567890')
  })
  it.each([NaN,Infinity,-1,0,'0.0000000000000000001','1e100','garbage'])('rejects invalid/unrepresentable price %s', price => {
    expect(priceToAtomic(price)).toBeNull()
  })
  it('converts scientific notation without a floating point multiplication', () => {
    expect(priceToAtomic(1e-10)).toBe('100000000')
    expect(priceToAtomic('1.234e3')).toBe('1234000000000000000000')
  })
})
