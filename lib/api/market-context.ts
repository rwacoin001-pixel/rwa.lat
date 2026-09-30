import { request } from './_http'
import type { MarketContext } from '@/lib/p0a-data'

export const getMarketContextView = () => request<MarketContext>('/v1/market-context')
