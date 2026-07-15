import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'

export const POLYMARKET_ERROR_CODES = {
  INTEGRATION_DISABLED: 'POLYMARKET_INTEGRATION_DISABLED',
  UPSTREAM_UNAVAILABLE: 'POLYMARKET_UPSTREAM_UNAVAILABLE',
  UPSTREAM_INVALID_RESPONSE: 'POLYMARKET_UPSTREAM_INVALID_RESPONSE',
  MARKET_NOT_FOUND: 'POLYMARKET_MARKET_NOT_FOUND',
  TOKEN_NOT_FOUND: 'POLYMARKET_TOKEN_NOT_FOUND',
  SYNC_IN_PROGRESS: 'POLYMARKET_SYNC_IN_PROGRESS',
  TRADING_DISABLED: 'POLYMARKET_TRADING_DISABLED',
  MARKET_DATA_STALE: 'POLYMARKET_MARKET_DATA_STALE',
} as const

export class PolymarketIntegrationDisabledError extends ServiceUnavailableException {
  constructor() {
    super({
      code: POLYMARKET_ERROR_CODES.INTEGRATION_DISABLED,
      message: 'Polymarket public market-data integration is disabled.',
    })
  }
}

export class PolymarketUpstreamError extends ServiceUnavailableException {
  constructor(code: typeof POLYMARKET_ERROR_CODES.UPSTREAM_UNAVAILABLE | typeof POLYMARKET_ERROR_CODES.UPSTREAM_INVALID_RESPONSE) {
    super({
      code,
      message: code === POLYMARKET_ERROR_CODES.UPSTREAM_INVALID_RESPONSE
        ? 'Polymarket returned an invalid response.'
        : 'Polymarket market data is temporarily unavailable.',
    })
  }
}

export function polymarketMarketNotFound(id: string) {
  return new NotFoundException({
    code: POLYMARKET_ERROR_CODES.MARKET_NOT_FOUND,
    message: `Polymarket market ${id} was not found.`,
  })
}

export function polymarketTokenNotFound(id: string) {
  return new NotFoundException({
    code: POLYMARKET_ERROR_CODES.TOKEN_NOT_FOUND,
    message: `Polymarket token ${id} was not found.`,
  })
}

export function polymarketSyncInProgress() {
  return new ConflictException({
    code: POLYMARKET_ERROR_CODES.SYNC_IN_PROGRESS,
    message: 'A Polymarket market sync lease is already active.',
  })
}

export function polymarketTradingDisabled() {
  return new ServiceUnavailableException({
    code: POLYMARKET_ERROR_CODES.TRADING_DISABLED,
    message: 'Polymarket order submission is disabled until user signing, eligibility, approval and production reconciliation are verified.',
  })
}
