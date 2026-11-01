import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

export const REWARD_ERROR_CODES = {
  NOT_LIVE: 'REWARD_NOT_FOUND', NOT_ELIGIBLE: 'REWARD_NOT_ELIGIBLE', POINTS_LOW: 'REWARD_POINTS_LOW',
  EXCHANGE_LIMIT: 'REWARD_EXCHANGE_LIMIT', COUPON_INVALID: 'REWARD_COUPON_INVALID',
  KEY_INVALID: 'REWARD_IDEMPOTENCY_KEY_INVALID', CURSOR_INVALID: 'REWARD_CURSOR_INVALID',
  BUDGET_EXHAUSTED: 'REWARD_COUPON_BUDGET_EXHAUSTED',
} as const
export const rewardNotLive = () => new NotFoundException({ code: REWARD_ERROR_CODES.NOT_LIVE, message: 'Rewards are not available.' })
export const rewardConflict = (code: string, reason?: string) => new ConflictException({ code, message: code, ...(reason ? { reason } : {}) })
export function requireRewardKey(key: string) {
  if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) {
    throw new BadRequestException({ code: REWARD_ERROR_CODES.KEY_INVALID, message: 'Idempotency-Key is required (1–128 visible ASCII characters).' })
  }
}
