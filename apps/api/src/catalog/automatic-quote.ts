export const QUOTE_REFRESH_MS = 5 * 60_000
export const QUOTE_MAX_AGE_MS = 10 * 60_000

export interface QuoteBinding {
  revision: number
  bindingId: string
  enabled: boolean
  issuerName: string
  tokenName: string
  tokenSymbol: string
  chain: string
  contractAddress: string
}

export interface ContractTokenQuote {
  coin: string
  symbol: string
  price: number | string
  timestamp: number
  confidence: number
}

export function automaticQuoteSource(binding: QuoteBinding): string {
  return `automatic:defillama:binding:${binding.bindingId}`
}

export function contractCoin(binding: Pick<QuoteBinding, 'chain' | 'contractAddress'>): string {
  const address = /^0x[0-9a-f]{40}$/i.test(binding.contractAddress)
    ? binding.contractAddress.toLowerCase() : binding.contractAddress
  return `${binding.chain}:${address}`
}

export function priceToAtomic(value: number | string): string | null {
  const match = String(value).match(/^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/)
  if (!match) return null
  const exponent = Number(match[3] ?? 0)
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) return null
  const digits = match[1] + (match[2] ?? '')
  const places = match[1].length + exponent + 18
  const atomic = (places <= 0 ? '0' : digits.slice(0, places).padEnd(places, '0')).replace(/^0+(?=\d)/, '')
  return atomic.length <= 78 && BigInt(atomic) > 0n ? atomic : null
}

/** Match an exact token, chain and contract. A symbol or underlying stock is insufficient. */
export function verifiedAutomaticQuote(binding: QuoteBinding, token: ContractTokenQuote | undefined, now: Date) {
  // Issuer and token name are operator-verified metadata; the feed authenticates the exact chain/contract and symbol.
  if (!binding.enabled || !token || token.coin !== contractCoin(binding) || token.symbol !== binding.tokenSymbol
    || !Number.isFinite(token.confidence) || token.confidence < 0.9 || token.confidence > 1
    || !Number.isSafeInteger(token.timestamp) || token.timestamp <= 0) return null
  const capturedAt = new Date(token.timestamp * 1000)
  const validUntil = new Date(capturedAt.getTime() + QUOTE_MAX_AGE_MS)
  const atomic = priceToAtomic(token.price)
  if (!atomic || !Number.isFinite(capturedAt.getTime()) || capturedAt > now || validUntil <= now) return null
  return { atomic, capturedAt, validUntil, source: automaticQuoteSource(binding) }
}
