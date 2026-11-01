'use client'

import { useI18n } from '@/lib/i18n'
import type { CouponKind, DrawReason } from '@/lib/rewards'

// Stage 3 copy (2026-11-01). Simple words; numbers come from the server.
const zh = {
  title: '券包 · 积分', kicker: '奖励', row: '券包 · 积分', rowValue: (points: string, n: number) => `${points} 分 · ${n} 张券`,
  today: '今天的奖励', posted: '卡片已发出', tapToFlip: '点一下翻开', flipping: '正在翻开…',
  front: '每天第一次发晒单卡，可以翻一次。每次都有奖。',
  reasons: { ok: '今天还可以翻一次', no_card_today: '今天发一张晒单卡，就能翻一次', too_new: '注册满 24 小时后才能翻', drawn: '今天已经翻过了，明天再来', frozen: '今天的奖励正在审核' } as Record<DrawReason, string>,
  points: '积分', pointsAvailable: '可用积分', pointsUnit: '分', plusPoints: (n: number) => `+${n}`,
  kinds: { prediction_place_fee: '下注费减免券', withdrawal_fee: '提现手续费券' } as Record<CouponKind, string>,
  upTo: '最多减', freeOnce: '免一次手续费', validUntil: (d: string) => `${d} 前有效`, usedOn: (d: string) => `${d} 已使用`, expiredOn: (d: string) => `${d} 已过期`,
  states: { available: '可用', locked: '使用中', used: '已使用', expired: '已过期', frozen: '审核中' },
  frozenNote: '这次奖励需要人工审核，通过后会放进券包。',
  toWallet: '去券包', ok: '好的', goPost: '去发晒单卡', retry: '重试',
  drawFailed: '没有翻开，请稍后再试。', loadFailed: '加载失败，请稍后再试。',
  exchangeTitle: (n: number) => `${n} 积分换一张下注费减免券`, exchange: '兑换', exchanged: '已兑换，券已放进券包',
  pointsLow: (n: number) => `还差 ${n} 积分`, exchangeLimit: '今天已经兑换过了',
  coupons: '我的券', noCoupons: '还没有券。翻奖励卡，或者用积分兑换。',
  history: '积分记录', noHistory: '还没有积分记录', more: '加载更多',
  reasonsRow: { draw: '每日奖励', exchange: '兑换减免券', admin: '系统调整' },
  rules: '券只能抵扣手续费，不能提现，不能转给别人。一笔订单只能用一张券。奖品和你晒单的盈亏无关。',
  couponInvalid: '这张券现在不能用，已经帮你关掉了。', useCoupon: '使用减免券', useWithdrawCoupon: '使用提现手续费券', discount: (v: string) => `−${v}`,
}
type Copy = typeof zh
const en: Copy = {
  title: 'Coupons · Points', kicker: 'Rewards', row: 'Coupons · Points', rowValue: (points: string, n: number) => `${points} pts · ${n} coupon${n === 1 ? '' : 's'}`,
  today: "Today's reward", posted: 'Card posted', tapToFlip: 'Tap to flip', flipping: 'Flipping…',
  front: 'Your first result card each day flips one reward. There is always a prize.',
  reasons: { ok: 'One flip left today', no_card_today: 'Post a result card today to flip one', too_new: 'Available 24 hours after sign-up', drawn: 'Flipped today. Come back tomorrow', frozen: "Today's reward is under review" },
  points: 'Points', pointsAvailable: 'Available points', pointsUnit: 'pts', plusPoints: (n: number) => `+${n}`,
  kinds: { prediction_place_fee: 'Bet fee coupon', withdrawal_fee: 'Withdrawal fee coupon' },
  upTo: 'Up to', freeOnce: 'One free withdrawal fee', validUntil: (d: string) => `Valid until ${d}`, usedOn: (d: string) => `Used ${d}`, expiredOn: (d: string) => `Expired ${d}`,
  states: { available: 'Ready', locked: 'In use', used: 'Used', expired: 'Expired', frozen: 'Under review' },
  frozenNote: 'This reward needs a manual review. It goes to your coupons once approved.',
  toWallet: 'Open coupons', ok: 'OK', goPost: 'Post a result card', retry: 'Retry',
  drawFailed: 'Could not flip. Please try again.', loadFailed: 'Could not load. Please try again.',
  exchangeTitle: (n: number) => `${n} points for a bet fee coupon`, exchange: 'Exchange', exchanged: 'Done. The coupon is in your wallet',
  pointsLow: (n: number) => `${n} more points needed`, exchangeLimit: 'Already exchanged today',
  coupons: 'My coupons', noCoupons: 'No coupons yet. Flip a reward or exchange points.',
  history: 'Points history', noHistory: 'No points yet', more: 'Load more',
  reasonsRow: { draw: 'Daily reward', exchange: 'Coupon exchange', admin: 'Adjustment' },
  rules: 'Coupons only reduce fees. They cannot be withdrawn or transferred. One coupon per order. Prizes do not depend on your results.',
  couponInvalid: 'This coupon cannot be used now, so it was turned off.', useCoupon: 'Use fee coupon', useWithdrawCoupon: 'Use withdrawal fee coupon', discount: (v: string) => `−${v}`,
}
export function useRewardsCopy(): Copy {
  const { locale } = useI18n()
  return locale === 'zh-CN' ? zh : en
}
