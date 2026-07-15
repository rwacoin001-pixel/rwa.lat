import { HttpException, HttpStatus } from '@nestjs/common'

export const PORTFOLIO_ERROR_CODES = {
  PRODUCT_NOT_FOUND: 'PORTFOLIO_PRODUCT_NOT_FOUND',
  QUOTE_STALE: 'PORTFOLIO_QUOTE_STALE',
  REDEMPTION_NOT_FOUND: 'PORTFOLIO_REDEMPTION_NOT_FOUND',
  REDEMPTION_STATE_INVALID: 'PORTFOLIO_REDEMPTION_STATE_INVALID',
} as const

export class PortfolioError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus) {
    super({ code, message }, status)
  }

  static productNotFound(id: string): PortfolioError {
    return new PortfolioError(PORTFOLIO_ERROR_CODES.PRODUCT_NOT_FOUND, `Product ${id} not found`, HttpStatus.NOT_FOUND)
  }

  static quoteStale(id: string): PortfolioError {
    return new PortfolioError(PORTFOLIO_ERROR_CODES.QUOTE_STALE, `Quote for product ${id} is stale`, HttpStatus.CONFLICT)
  }

  static redemptionNotFound(id: string): PortfolioError {
    return new PortfolioError(PORTFOLIO_ERROR_CODES.REDEMPTION_NOT_FOUND, `Redemption ${id} not found`, HttpStatus.NOT_FOUND)
  }

  static redemptionStateInvalid(id: string, state: string): PortfolioError {
    return new PortfolioError(
      PORTFOLIO_ERROR_CODES.REDEMPTION_STATE_INVALID,
      `Redemption ${id} is in state ${state} and cannot be changed`,
      HttpStatus.CONFLICT,
    )
  }
}
