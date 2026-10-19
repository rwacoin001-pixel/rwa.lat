import type { AppLocale } from '@/lib/i18n'

export type QuantCopy = {
  nav: string
  kicker: string
  title: string
  comingSoon: string
  comingSoonBody: string
  loadError: string
  retry: string
  settledTo: string
  neverSettled: string
  sinceInception: string
  indexLabel: string
  indexShort: string
  scaleNote: string
  recorded: (days: number) => string
  ledgerTitle: string
  legend: { gain: string; loss: string; flat: string; missing: string; today: string }
  tickGain: string
  tickLoss: string
  tickFlat: string
  tickMissing: string
  tickToday: string
  last7: string
  last30: string
  drawdown: string
  partial: (days: number) => string
  target: string
  targetValue: (min: string, max: string) => string
  targetNote: string
  riskLine: string
  flowTitle: string
  flowGain: string
  flowGainBody: string
  flowLoss: string
  flowLossBody: string
  feesTitle: string
  feeManagement: (pct: string) => string
  feePerformance: (pct: string) => string
  feeRedemption: (days: number, pct: string) => string
  feeRedemptionFree: (days: number) => string
  rulesTitle: string
  ruleCutoff: (time: string, zone: string) => string
  ruleStart: string
  ruleDaily: string
  indexNote: string
  disclosure: string
  subscribe: string
  redeem: string
  addMore: string
  closedNote: string
  position: {
    title: string
    principal: string
    paid: string
    lastDay: string
    waiting: string
    pending: string
    toWithdraw: string
    paidNote: string
    receipt: string
    gross: string
    management: string
    performance: string
    net: string
    credited: string
    reduced: string
    emptyPayouts: string
    orderSubscription: string
    orderRedemption: string
    orderEffective: (date: string) => string
  }
  sheet: {
    subscribeTitle: string
    redeemTitle: string
    amount: string
    available: string
    min: (amount: string) => string
    quick: string
    timelineTitle: string
    stepSubmit: string
    stepStart: string
    stepSettle: string
    stepSubmitBody: (time: string, zone: string) => string
    stepStartBody: string
    stepSettleBody: string
    afterCutoff: string
    ack: string
    confirmSubscribe: (amount: string) => string
    confirmRedeem: string
    redeemAll: string
    redeemable: string
    waitingLocked: string
    estimateTitle: string
    estimateFee: string
    estimatePayout: string
    estimateNote: string
    redeemSteps: { submit: string; settle: string; arrive: string }
    done: string
    doneSubscribe: (date: string) => string
    doneRedeem: string
    close: string
    errors: Record<string, string>
    errorFallback: string
  }
}

const en: QuantCopy = {
  nav: 'Quant',
  kicker: 'KOALA QUANT',
  title: 'Koala Quant',
  comingSoon: 'Opening soon',
  comingSoonBody: 'Koala Quant is not open yet. Check back soon.',
  loadError: 'Couldn’t load Koala Quant.',
  retry: 'Retry',
  settledTo: 'Settled to',
  neverSettled: 'Not settled yet',
  sinceInception: 'Since inception',
  indexLabel: 'Index (after management fee)',
  indexShort: 'Index',
  scaleNote: 'A ring is full at 3% (7 days), 8% (30 days) and 5% (drawdown).',
  recorded: (days) => `${days} days recorded`,
  ledgerTitle: 'Daily settlement',
  legend: { gain: 'Gain', loss: 'Loss (principal reduced)', flat: 'Settled at 0.00%', missing: 'No record yet', today: 'Today, not settled' },
  tickGain: 'Gain',
  tickLoss: 'Loss',
  tickFlat: 'Flat',
  tickMissing: 'No record yet',
  tickToday: 'Today is not settled until it ends',
  last7: '7 days',
  last30: '30 days',
  drawdown: 'Max drawdown',
  partial: (days) => `${days}d recorded`,
  target: 'Target range',
  targetValue: (min, max) => `${min}–${max}% a year`,
  targetNote: 'A target, not a promise. Actual results can be lower and you can lose principal.',
  riskLine: 'Your principal can fall. Past results don’t predict future ones.',
  flowTitle: 'Where the money goes',
  flowGain: 'On a gain day',
  flowGainBody: 'After fees, the profit goes to your available balance the same day, ready to withdraw.',
  flowLoss: 'On a loss day',
  flowLossBody: 'The loss reduces your principal. Nothing is taken from your balance.',
  feesTitle: 'Fees',
  feeManagement: (pct) => `Management fee ${pct}% a year, charged daily`,
  feePerformance: (pct) => `Performance fee ${pct}% of new gains above the product’s high-water mark`,
  feeRedemption: (days, pct) => `Redeem within ${days} days: ${pct}%`,
  feeRedemptionFree: (days) => `Redeem after ${days} days: free`,
  rulesTitle: 'How it works',
  ruleCutoff: (time, zone) => `Orders placed before ${time} (${zone}) count for that day; later ones count for the next day.`,
  ruleStart: 'A subscription starts earning the day after its trade date.',
  ruleDaily: 'Each day is settled after it ends. A redemption is paid after the settlement of its trade date.',
  indexNote: 'The index is after the management fee. The performance fee is taken from each payout, so your own receipt is what you actually receive.',
  disclosure: 'Risk disclosure',
  subscribe: 'Subscribe',
  redeem: 'Redeem',
  addMore: 'Add',
  closedNote: 'Subscriptions are paused. Your position and daily settlement continue.',
  position: {
    title: 'My Koala Quant',
    principal: 'Principal (USDT)',
    paid: 'Paid out so far',
    lastDay: 'Latest settlement',
    waiting: 'Not earning yet',
    pending: 'Pending',
    toWithdraw: 'Withdraw',
    paidNote: 'Paid-out profit is in your available balance, not in your principal.',
    receipt: 'Settlement receipt',
    gross: 'Strategy return',
    management: 'Management fee',
    performance: 'Performance fee',
    net: 'Net',
    credited: 'Added to available balance',
    reduced: 'Principal reduced',
    emptyPayouts: 'Your first settlement will appear here.',
    orderSubscription: 'Subscription',
    orderRedemption: 'Redemption',
    orderEffective: (date) => `Trade date ${date}`,
  },
  sheet: {
    subscribeTitle: 'Subscribe to Koala Quant',
    redeemTitle: 'Redeem principal',
    amount: 'Amount',
    available: 'Available',
    min: (amount) => `Min ${amount}`,
    quick: 'Quick amounts',
    timelineTitle: 'When your money starts earning',
    stepSubmit: 'Submitted',
    stepStart: 'Starts earning',
    stepSettle: 'First payout',
    stepSubmitBody: (time, zone) => `Cutoff ${time} (${zone}); later orders count for the next day.`,
    stepStartBody: 'The first day that counts toward your return.',
    stepSettleBody: 'That day is settled after it ends. Profit goes to your available balance; a loss reduces principal.',
    afterCutoff: 'It’s past today’s cutoff, so this order counts for tomorrow.',
    ack: 'I’ve read and accept the risk disclosure',
    confirmSubscribe: (amount) => `Subscribe ${amount} USDT`,
    confirmRedeem: 'Request redemption',
    redeemAll: 'Redeem all',
    redeemable: 'Redeemable now',
    waitingLocked: 'Not earning yet, can’t be redeemed',
    estimateTitle: 'Estimate',
    estimateFee: 'Redemption fee',
    estimatePayout: 'You receive',
    estimateNote: 'An estimate. The final amount is set at the end of the trade date, after that day’s result is applied.',
    redeemSteps: { submit: 'Request submitted', settle: 'Trade date is settled', arrive: 'Fee deducted, paid to available balance' },
    done: 'Done',
    doneSubscribe: (date) => `Subscribed. It starts earning on ${date}.`,
    doneRedeem: 'Redemption requested. It’s paid after the next settlement.',
    close: 'Close',
    errors: {
      QUANT_INSUFFICIENT_BALANCE: 'Your available balance is too low.',
      QUANT_PRODUCT_NOT_OPEN: 'This product isn’t open right now.',
      QUANT_AMOUNT_INVALID: 'Check the amount and try again.',
      QUANT_NOTHING_TO_REDEEM: 'You don’t hold any principal here.',
      QUANT_REDEMPTION_PENDING: 'You already have a redemption waiting for settlement.',
      QUANT_DISCLOSURE_ACK_REQUIRED: 'Accept the risk disclosure first.',
      OPERATIONAL_SWITCH_DISABLED: 'This isn’t open right now.',
    },
    errorFallback: 'Couldn’t complete that. Try again.',
  },
}

const zh: QuantCopy = {
  nav: '量化',
  kicker: 'KOALA QUANT',
  title: '考拉量化',
  comingSoon: '即将开放',
  comingSoonBody: '考拉量化暂未开放,敬请期待。',
  loadError: '考拉量化加载失败。',
  retry: '重试',
  settledTo: '已结算至',
  neverSettled: '尚未开始结算',
  sinceInception: '成立以来',
  indexLabel: '净值指数(已扣管理费)',
  indexShort: '净值',
  scaleNote: '圆环满格:7 日 3% · 30 日 8% · 回撤 5%',
  recorded: (days) => `已记录 ${days} 日`,
  ledgerTitle: '每日结算',
  legend: { gain: '盈利日', loss: '亏损日(本金减少)', flat: '已结算 0.00%', missing: '暂无记录', today: '今日未结算' },
  tickGain: '盈利',
  tickLoss: '亏损',
  tickFlat: '持平',
  tickMissing: '暂无记录',
  tickToday: '今日结束后才会结算',
  last7: '近 7 日',
  last30: '近 30 日',
  drawdown: '最大回撤',
  partial: (days) => `已记录 ${days} 日`,
  target: '目标区间',
  targetValue: (min, max) => `年化 ${min}–${max}%`,
  targetNote: '仅为目标,不是承诺。实际表现可能更低,本金可能亏损。',
  riskLine: '本金可能亏损;历史表现不代表未来。',
  flowTitle: '钱怎么走',
  flowGain: '盈利日',
  flowGainBody: '扣除费用后,当天进入你的可用余额,可直接提现。',
  flowLoss: '亏损日',
  flowLossBody: '亏损计入本金,不会从你的余额里扣钱。',
  feesTitle: '费用',
  feeManagement: (pct) => `管理费 年化 ${pct}%,按日计提`,
  feePerformance: (pct) => `业绩提成 ${pct}%,仅对产品高水位以上的新增收益收取`,
  feeRedemption: (days, pct) => `持有不足 ${days} 天赎回:${pct}%`,
  feeRedemptionFree: (days) => `持有满 ${days} 天后赎回:免费`,
  rulesTitle: '规则',
  ruleCutoff: (time, zone) => `${time}(${zone})前提交的申请算当天,之后算次日。`,
  ruleStart: '申购从其交易日的次日起息。',
  ruleDaily: '每个交易日结束后结算;赎回在其交易日结算后兑付。',
  indexNote: '指数已扣管理费;业绩提成在每次派发时扣除,以你自己的结算凭单为准。',
  disclosure: '风险披露',
  subscribe: '申购',
  redeem: '赎回',
  addMore: '追加申购',
  closedNote: '申购已暂停,已有持仓和每日结算不受影响。',
  position: {
    title: '我的考拉量化',
    principal: '当前本金 USDT',
    paid: '累计已派发',
    lastDay: '最近一次结算',
    waiting: '尚未起息',
    pending: '处理中',
    toWithdraw: '去提现',
    paidNote: '已派发的收益在可用余额里,不在本金里。',
    receipt: '结算凭单',
    gross: '策略收益',
    management: '管理费',
    performance: '业绩提成',
    net: '净额',
    credited: '已进入可用余额',
    reduced: '本金减少',
    emptyPayouts: '首次结算后,这里会显示你的每日凭单。',
    orderSubscription: '申购',
    orderRedemption: '赎回',
    orderEffective: (date) => `交易日 ${date}`,
  },
  sheet: {
    subscribeTitle: '申购考拉量化',
    redeemTitle: '赎回本金',
    amount: '金额',
    available: '可用余额',
    min: (amount) => `最小 ${amount}`,
    quick: '快捷金额',
    timelineTitle: '这笔钱什么时候开始算收益',
    stepSubmit: '提交申请',
    stepStart: '起息',
    stepSettle: '首次派发',
    stepSubmitBody: (time, zone) => `截止 ${time}(${zone}),之后算次日。`,
    stepStartBody: '从这一天开始计入你的收益。',
    stepSettleBody: '该日结束后结算:盈利进可用余额,亏损计入本金。',
    afterCutoff: '已过今日截止时间,这笔申请算明天。',
    ack: '我已阅读并接受风险披露',
    confirmSubscribe: (amount) => `确认申购 ${amount} USDT`,
    confirmRedeem: '确认申请赎回',
    redeemAll: '全部赎回',
    redeemable: '当前可赎回',
    waitingLocked: '尚未起息,暂不可赎回',
    estimateTitle: '预估',
    estimateFee: '赎回费',
    estimatePayout: '预计到账',
    estimateNote: '仅为预估。最终金额在其交易日结束、计入当日收益后确定。',
    redeemSteps: { submit: '提交申请', settle: '交易日结算', arrive: '扣除赎回费,转入可用余额' },
    done: '完成',
    doneSubscribe: (date) => `申购成功,${date} 起息。`,
    doneRedeem: '已提交赎回,下次结算后兑付。',
    close: '关闭',
    errors: {
      QUANT_INSUFFICIENT_BALANCE: '可用余额不足。',
      QUANT_PRODUCT_NOT_OPEN: '产品暂未开放。',
      QUANT_AMOUNT_INVALID: '请检查金额后重试。',
      QUANT_NOTHING_TO_REDEEM: '你在该产品里没有本金。',
      QUANT_REDEMPTION_PENDING: '你已有一笔赎回在等待结算。',
      QUANT_DISCLOSURE_ACK_REQUIRED: '请先接受风险披露。',
      OPERATIONAL_SWITCH_DISABLED: '功能暂未开放。',
    },
    errorFallback: '操作没有完成,请重试。',
  },
}

/** Other locales use the English copy until they are translated; numbers, dates and the ledger do not depend on language. */
const copyByLocale: Partial<Record<AppLocale, QuantCopy>> = { en, 'zh-CN': zh }

export function quantCopyFor(locale: AppLocale): QuantCopy {
  return copyByLocale[locale] ?? en
}

export function quantErrorMessage(copy: QuantCopy, code: string | undefined): string {
  return (code && copy.sheet.errors[code]) || copy.sheet.errorFallback
}
