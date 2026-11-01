import { IsOptional, IsString, MaxLength } from 'class-validator'

export class RewardPointsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string
}
export type CouponKind = 'prediction_place_fee' | 'withdrawal_fee' | 'prediction_stake'
export type Coupon = {
  id: string; kind: CouponKind; maxDiscountAtomic: string; assetCode: 'USDT'; assetDecimals: 6
  state: 'available' | 'locked' | 'used' | 'expired' | 'frozen'; source: 'draw' | 'exchange'
  expiresAt: string; createdAt: string; usedAt: string | null
}
export type Draw = {
  id: string; sgDate: string; state: 'granted' | 'frozen'
  serial: string; tier: 'common' | 'rare' | 'epic' | 'legend'
  prize: { kind: 'points'; points: number; voucher: null; coupon: null }
    | { kind: 'coupon'; points: number; voucher: null; coupon: Coupon }
    | { kind?: undefined; points: number; voucher: Coupon | null; coupon: null }; createdAt: string
}
export type Today = { sgDate: string; eligible: boolean; reason: 'ok' | 'no_card_today' | 'too_new' | 'drawn' | 'frozen'; draw: Draw | null }
