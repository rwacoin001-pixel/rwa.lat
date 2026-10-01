import { Injectable } from '@nestjs/common'
import { ContractTokenQuote } from './automatic-quote'

/** Keyless public DeFiLlama USD prices. Never resolve a token by symbol or underlying asset. */
@Injectable()
export class FreeContractPriceClient {
  async get(coins: string[]): Promise<ContractTokenQuote[]> {
    const ids = [...new Set(coins)]
    if (!ids.length) return []
    if (ids.length > 50 || ids.some(id => id.startsWith('coingecko:') || !/^[a-z][a-z0-9-]{1,63}:[a-zA-Z0-9]{20,128}$/.test(id))) {
      throw new Error('Invalid contract price request')
    }
    const response = await fetch(`https://coins.llama.fi/prices/current/${ids.map(encodeURIComponent).join(',')}?searchWidth=10m`, {
      signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' }, redirect: 'error',
    })
    if (!response.ok) throw new Error('Contract price provider unavailable')
    const payload = await response.json() as { coins?: Record<string, Omit<ContractTokenQuote, 'coin'>> }
    if (!payload.coins || typeof payload.coins !== 'object' || Array.isArray(payload.coins)) {
      throw new Error('Invalid contract price response')
    }
    return ids.flatMap(coin => {
      const quote = payload.coins![coin]
      return quote && typeof quote === 'object' ? [{ ...quote, coin }] : []
    })
  }
}
