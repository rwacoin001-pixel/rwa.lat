/** CoinMarketCap RWA 家族原始响应类型（实测校准 2026-09-18） */

export type CmcStatus = {
  timestamp?: string
  error_code?: string
  error_message?: string
  credit_count?: number
  elapsed?: number
}

export type CmcEnvelope<T> = {
  data: T | null
  status?: CmcStatus
}

export type CmcRwaIdEntry = {
  name: string
  symbol?: string | null
  slug: string
  rwa_id?: number | null
  asset_type?: string | null
  rwa_rank?: number | null
  has_tokens?: boolean | null
  first_historical_data?: string
  last_historical_data?: string
}

export type CmcRwaToken = {
  symbol?: string
  name?: string
  crypto_id?: number
  issuer_id?: string
  issuer_name?: string
  price?: number
  market_cap?: number
  volume_24h?: number
}

export type CmcRwaQuote = {
  symbol?: string
  crypto_id?: number
  average_tokenized_price?: number
  tokenized_market_cap?: number
  tokenized_volume_24h?: number
  last_updated?: string
}

export type CmcRwaAssetListItem = CmcRwaIdEntry & {
  quotes?: CmcRwaQuote[]
  average_tokenized_price?: number
  tokenized_market_cap?: number
  tokenized_volume_24h?: number
  last_updated?: string
  tokens?: CmcRwaToken[]
}

export type CmcRwaListResponse = {
  total_size?: number
  has_more?: boolean
  rwa_assets: CmcRwaAssetListItem[]
}

export type CmcRwaInfoEntry = {
  name: string
  symbol?: string | null
  slug: string
  website?: string | null
  logo?: string | null
  employees?: number | null
  founded?: string | null
  industry?: string | null
  cik?: string | null
  about?: { description?: string } | null
}

export type CmcIssuerListItem = {
  name: string
  website?: string | null
  logo?: string | null
  issuer_id: string
  num_tokens?: number
}

export type CmcIssuerListResponse = {
  issuers: CmcIssuerListItem[]
  total_size?: number
  has_more?: boolean
}

export type CmcIssuerDetail = {
  name?: string
  website?: string | null
  logo?: string | null
  tokens?: Array<{ name?: string; symbol?: string; crypto_id?: number; rwa_id?: number }>
}
