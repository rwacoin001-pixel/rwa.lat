import { request } from './_http'

export type PortfolioSummary = {
  currency: 'USDT'
  decimals: 6
  totalAtomic: string
  today: null | {
    changeAtomic: string
    changePct: string | null
    since: string
    basis: 'ledger'
  }
  asOf: string
}

export const getPortfolioSummary = () => request<PortfolioSummary>('/v1/portfolio/summary')
