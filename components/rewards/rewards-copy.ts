'use client'

import { useI18n } from '@/lib/i18n'
import type { CouponKind, DrawReason, DrawTier } from '@/lib/rewards'

// Stage 3 copy (2026-11-01; v2 printed tickets 2026-11-02). Simple words; numbers come from the server.
const zh = {
  title: '券包 · 积分', kicker: '奖励', row: '券包 · 积分', rowValue: (points: string, n: number) => `${points} 分 · ${n} 张券`,
  today: '今日奖券', posted: '卡片已发出',
  front: '每天第一次发晒单卡，可以打印一张奖券。每张都有积分和一张下注券。',
  reasons: { ok: '今天的奖券可以打印了', no_card_today: '今天发一张晒单卡，就能打印一张奖券', too_new: '注册满 24 小时后才能打印', drawn: '今天已经打印过了，明天再来', frozen: '今天的奖券正在审核' } as Record<DrawReason, string>,
  bannerReasons: { ok: '可以打印了', no_card_today: '发一张晒单卡就能打印', too_new: '注册满 24 小时后可打印', drawn: '今天已打印', frozen: '正在审核' } as Record<DrawReason, string>,
  print: '去打印', view: '查看', postShort: '发晒单卡', slidePrint: '滑动打印今天的奖券', printing: '正在打印…', slideClaim: '滑动收下', claimed: '已放进券包',
  ticketTitle: '每日奖券', printer: 'A-REIT · 奖券机',
  tiers: { common: '普通', rare: '稀有', epic: '史诗', legend: '传说' } as Record<DrawTier, string>,
  date: '日期', time: '时间', validTill: '有效期至', serial: '奖券号',
  voucherNote: '一次下注的本金由券支付，免下注费，赢了全额给你。',
  points: '积分', pointsAvailable: '可用积分', pointsUnit: '分', plusPoints: (n: number) => `+${n}`,
  kinds: { prediction_place_fee: '下注费减免券', withdrawal_fee: '提现手续费券', prediction_stake: '下注券' } as Record<CouponKind, string>,
  upTo: '最多减', freeOnce: '免一次手续费', validUntil: (d: string) => `${d} 前有效`, usedOn: (d: string) => `${d} 已使用`, expiredOn: (d: string) => `${d} 已过期`,
  states: { available: '可用', locked: '使用中', used: '已使用', expired: '已过期', frozen: '审核中' },
  frozenNote: '这张奖券需要人工审核，通过后会放进券包。',
  toWallet: '去券包', ok: '好的', goPost: '去发晒单卡', retry: '重试', close: '关闭',
  drawFailed: '没有打印出来，请再滑一次。', loadFailed: '加载失败，请稍后再试。',
  exchangeTitle: (n: number) => `${n} 积分换一张 1 USDT 下注券`, exchange: '兑换', exchanged: '已兑换，券已放进券包',
  pointsLow: (n: number) => `还差 ${n} 积分`, exchangeLimit: '今天已经兑换过了',
  coupons: '我的券', noCoupons: '还没有券。打印每日奖券，或者用积分兑换。',
  history: '积分记录', noHistory: '还没有积分记录', more: '加载更多',
  reasonsRow: { draw: '每日奖券', exchange: '兑换下注券', admin: '系统调整' },
  odds: '中奖概率', oddsNote: '每张奖券都有积分和一张下注券，两样分开抽。概率和你晒单的盈亏、余额都无关。大额券每天有数量上限，抽完后发 1 USDT 下注券。',
  oddsPoints: '积分', oddsVoucher: '下注券', perDay: (n: number) => `每天 ${n} 张`,
  rules: '券不能提现，不能转给别人。下注券用来支付一次下注的本金，赢了全额归你；充值过一次后才能用。一笔订单只能用一张券。',
  couponInvalid: '这张券现在不能用，已经帮你关掉了。', useCoupon: '使用减免券', useWithdrawCoupon: '使用提现手续费券', discount: (v: string) => `−${v}`,
  useVoucher: '用下注券', voucherNone: '不用', voucherHint: '本金由券支付 · 免下注费 · 赢了全额给你',
  voucherErrors: { REWARD_VOUCHER_DEPOSIT_REQUIRED: '充值过一次后才能用下注券。', REWARD_VOUCHER_PRICE: '下注券不能用在概率高于 90% 的选项上。', REWARD_VOUCHER_HEDGE: '同一个事件，下注券只能押一边。', REWARD_VOUCHER_STAKE: '用下注券时，下注金额就是券的面额。' } as Record<string, string>,
}
type Copy = typeof zh
const en: Copy = {
  title: 'Coupons · Points', kicker: 'Rewards', row: 'Coupons · Points', rowValue: (points: string, n: number) => `${points} pts · ${n} coupon${n === 1 ? '' : 's'}`,
  today: "Today's ticket", posted: 'Card posted',
  front: 'Your first result card each day prints one ticket. Every ticket has points and a bet voucher.',
  reasons: { ok: "Today's ticket is ready to print", no_card_today: 'Post a result card today to print a ticket', too_new: 'Available 24 hours after sign-up', drawn: 'Printed today. Come back tomorrow', frozen: "Today's ticket is under review" },
  bannerReasons: { ok: 'Ready to print', no_card_today: 'Post a card to print one', too_new: 'Available after 24 hours', drawn: 'Printed today', frozen: 'Under review' },
  print: 'Print', view: 'View', postShort: 'Post a card', slidePrint: "Slide to print today's ticket", printing: 'Printing…', slideClaim: 'Slide to keep', claimed: 'In your wallet',
  ticketTitle: 'Daily ticket', printer: 'A-REIT · TICKETS',
  tiers: { common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legend' },
  date: 'Date', time: 'Time', validTill: 'Valid till', serial: 'Ticket no.',
  voucherNote: 'Pays the stake of one bet, no bet fee, and a win pays you in full.',
  points: 'Points', pointsAvailable: 'Available points', pointsUnit: 'pts', plusPoints: (n: number) => `+${n}`,
  kinds: { prediction_place_fee: 'Bet fee coupon', withdrawal_fee: 'Withdrawal fee coupon', prediction_stake: 'Bet voucher' },
  upTo: 'Up to', freeOnce: 'One free withdrawal fee', validUntil: (d: string) => `Valid until ${d}`, usedOn: (d: string) => `Used ${d}`, expiredOn: (d: string) => `Expired ${d}`,
  states: { available: 'Ready', locked: 'In use', used: 'Used', expired: 'Expired', frozen: 'Under review' },
  frozenNote: 'This ticket needs a manual review. It goes to your wallet once approved.',
  toWallet: 'Open wallet', ok: 'OK', goPost: 'Post a result card', retry: 'Retry', close: 'Close',
  drawFailed: 'Could not print. Please slide again.', loadFailed: 'Could not load. Please try again.',
  exchangeTitle: (n: number) => `${n} points for a 1 USDT bet voucher`, exchange: 'Exchange', exchanged: 'Done. The voucher is in your wallet',
  pointsLow: (n: number) => `${n} more points needed`, exchangeLimit: 'Already exchanged today',
  coupons: 'My coupons', noCoupons: 'No coupons yet. Print a daily ticket or exchange points.',
  history: 'Points history', noHistory: 'No points yet', more: 'Load more',
  reasonsRow: { draw: 'Daily ticket', exchange: 'Voucher exchange', admin: 'Adjustment' },
  odds: 'Odds', oddsNote: 'Every ticket has points and a bet voucher, drawn separately. Odds never depend on your results or balance. Large vouchers have a daily limit; after that the voucher is 1 USDT.',
  oddsPoints: 'Points', oddsVoucher: 'Bet voucher', perDay: (n: number) => `${n} a day`,
  rules: 'Coupons cannot be withdrawn or transferred. A bet voucher pays the stake of one bet and a win is yours in full; it works after your first deposit. One coupon per order.',
  couponInvalid: 'This coupon cannot be used now, so it was turned off.', useCoupon: 'Use fee coupon', useWithdrawCoupon: 'Use withdrawal fee coupon', discount: (v: string) => `−${v}`,
  useVoucher: 'Use a bet voucher', voucherNone: 'None', voucherHint: 'The voucher pays the stake · no bet fee · a win is paid in full',
  voucherErrors: { REWARD_VOUCHER_DEPOSIT_REQUIRED: 'Bet vouchers work after your first deposit.', REWARD_VOUCHER_PRICE: 'Bet vouchers cannot be used on outcomes above 90%.', REWARD_VOUCHER_HEDGE: 'One side per event with bet vouchers.', REWARD_VOUCHER_STAKE: 'With a voucher the stake is the voucher amount.' },
}
export function useRewardsCopy(): Copy {
  const { locale } = useI18n()
  return locale === 'zh-CN' ? zh : en
}
