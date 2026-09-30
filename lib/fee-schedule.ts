/**
 * Fee schedule — 全站唯一费率数据源（圆桌第4场 P0-A #6 裁定）
 * 任何页面展示费用必须从本文件读取，不得内联硬编码。
 * 页面：/fees-and-limits（fee center）展示本表全部内容。
 */

export const FEE_SCHEDULE = {
  version: 'v2',
  updatedAt: '2026-09-30',
  /** 交易费（下单时收取，按产品类别） */
  order: {
    default: 0.008, // RWA / AI Compute：0.80%
    stocks: 0.0035, // 股票组合：0.35%
    prediction: 0.03, // 预测市场 · 下注费：3.00%（下注时从本金扣除）
    predictionPayout: 0.03, // 预测市场 · 派彩费：3.00%（赢家派彩时从毛派彩扣除）
    tbill: 0.002, // 代币化短期国债：0.20%
    tbillProductId: 'tokenized-tbill-91d',
    minFeeUsdt: 1.5, // 单笔最低手续费
  },
  /** 网络费（提现时收取，按链） */
  network: {
    TRON: 0.8,
    Ethereum: 8.5,
    Arbitrum: 1.6,
  } as Record<string, number>,
  /** 管理费（年化，从产品收益中计提，不在下单时收取） */
  management: {
    rwa: 0.01, // 1.00% p.a.
    compute: 0.015, // 1.50% p.a.
    stocks: 0, // 0%（无管理费）
    prediction: 0, // 0%
  },
  /** 赎回 */
  redemption: {
    feeRate: 0, // 标准赎回 0 费用
    earlyExitNote: '提前退出按产品条款执行；锁定期内不可赎回，窗口期外顺延至下一窗口。',
  },
  /** 限额 */
  limits: {
    minInvestmentUsdt: 100,
    minWithdrawUsdt: 10,
    maxDailyWithdrawUsdt: 100000,
  },
  /** 生效说明 */
  notes: [
    '费用在下单确认页展示后才收取，不存在隐藏费用。',
    '网络费为区块链结算成本，随链上拥堵情况可能调整，以确认页实时展示为准。',
    '管理费从产品收益中计提，不单独向账户收取。',
    '限制与窗口以产品详情页条款为准；本页为全站费率汇总入口。',
  ],
} as const

export type FeeSchedule = typeof FEE_SCHEDULE

/** 下单费率（按产品 id / 类别）。预测市场返回的是「下注费」；派彩另收 predictionPayout。 */
export function orderFeeRate(product: { id: string; category: string }): number {
  if (product.id === FEE_SCHEDULE.order.tbillProductId) return FEE_SCHEDULE.order.tbill
  if (product.category === 'Stocks') return FEE_SCHEDULE.order.stocks
  if (product.category === 'Prediction') return FEE_SCHEDULE.order.prediction
  return FEE_SCHEDULE.order.default
}

/** 实际下单手续费（含最低费） */
export function orderFee(product: { id: string; category: string }, amount: number): number {
  return Math.max(FEE_SCHEDULE.order.minFeeUsdt, amount * orderFeeRate(product))
}

/** 提现网络费 */
export function networkFee(network: string): number {
  return FEE_SCHEDULE.network[network] ?? 0
}
