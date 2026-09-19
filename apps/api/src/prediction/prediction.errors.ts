import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common'

export const PREDICTION_ERROR_CODES = {
  BETTING_DISABLED: 'PREDICTION_BETTING_DISABLED',
  MARKET_NOT_TRADEABLE: 'PREDICTION_MARKET_NOT_TRADEABLE',
  PRICE_UNAVAILABLE: 'PREDICTION_PRICE_UNAVAILABLE',
  SLIPPAGE_EXCEEDED: 'PREDICTION_SLIPPAGE_EXCEEDED',
  STAKE_LIMIT_EXCEEDED: 'PREDICTION_STAKE_LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED: 'PREDICTION_DAILY_LIMIT_EXCEEDED',
  MARKET_EXPOSURE_LIMIT: 'PREDICTION_MARKET_EXPOSURE_LIMIT',
  INSUFFICIENT_BALANCE: 'PREDICTION_INSUFFICIENT_BALANCE',
  BET_NOT_FOUND: 'PREDICTION_BET_NOT_FOUND',
} as const

export const PREDICTION_SWITCH_KEY = 'prediction.betting'

export function predictionBettingDisabled() {
  return new ServiceUnavailableException({
    code: PREDICTION_ERROR_CODES.BETTING_DISABLED,
    message: 'Prediction betting is currently disabled by operations.',
  })
}

export function predictionMarketNotTradeable(id: string) {
  return new ConflictException({
    code: PREDICTION_ERROR_CODES.MARKET_NOT_TRADEABLE,
    message: `Prediction market ${id} is not open for betting.`,
  })
}

export function predictionPriceUnavailable(tokenId: string) {
  return new ServiceUnavailableException({
    code: PREDICTION_ERROR_CODES.PRICE_UNAVAILABLE,
    message: `No tradable price is available for outcome token ${tokenId}.`,
  })
}

export function predictionSlippageExceeded(expected: string, actual: string) {
  return new ConflictException({
    code: PREDICTION_ERROR_CODES.SLIPPAGE_EXCEEDED,
    message: 'The price moved beyond the allowed slippage. Please refresh and retry.',
    expectedPrice: expected,
    actualPrice: actual,
  })
}

export function predictionStakeLimitExceeded(limitAtomic: string) {
  return new ConflictException({
    code: PREDICTION_ERROR_CODES.STAKE_LIMIT_EXCEEDED,
    message: `A single bet may not exceed ${limitAtomic} atomic units.`,
  })
}

export function predictionDailyLimitExceeded(limitAtomic: string) {
  return new ConflictException({
    code: PREDICTION_ERROR_CODES.DAILY_LIMIT_EXCEEDED,
    message: `The rolling 24-hour betting limit of ${limitAtomic} atomic units would be exceeded.`,
  })
}

export function predictionMarketExposureLimit(limitAtomic: string) {
  return new ConflictException({
    code: PREDICTION_ERROR_CODES.MARKET_EXPOSURE_LIMIT,
    message: `This market has reached its platform exposure limit of ${limitAtomic} atomic units.`,
  })
}

export function predictionInsufficientBalance() {
  return new ConflictException({
    code: PREDICTION_ERROR_CODES.INSUFFICIENT_BALANCE,
    message: 'The account balance is insufficient for this bet.',
  })
}

export function predictionBetNotFound(id: string) {
  return new NotFoundException({
    code: PREDICTION_ERROR_CODES.BET_NOT_FOUND,
    message: `Prediction bet ${id} was not found.`,
  })
}
