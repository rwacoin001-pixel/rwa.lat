import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CircleDollarSign,
  LockKeyhole,
  type LucideIcon,
} from 'lucide-react'

export type DisplayDirection = 'in' | 'out' | 'hold' | 'context'

export type LedgerDisplay = {
  label: string
  icon: LucideIcon
  direction: DisplayDirection
}

type LabelSet = {
  en: string
  zh: string
}

const LEDGER_LABELS: Record<string, LabelSet> = {
  deposit: { en: 'Deposit', zh: '充值' },
  seed_deposit: { en: 'Initial funding', zh: '初始入金' },
  withdrawal_lock: { en: 'Withdrawal pending', zh: '提现处理中' },
  withdrawal_settlement: { en: 'Withdrawal complete', zh: '提现完成' },
  withdrawal_refund: { en: 'Withdrawal refund', zh: '提现退回' },
  internal_transfer: { en: 'Transfer', zh: '转账' },
  order_settlement: { en: 'Order settlement', zh: '订单结算' },
  order_lock: { en: 'Order pending', zh: '订单处理中' },
  investment: { en: 'Investment', zh: '投资' },
  seed_investment: { en: 'Initial investment', zh: '初始投资' },
  redemption: { en: 'Redemption', zh: '赎回' },
  yield_distribution: { en: 'Yield distribution', zh: '收益分配' },
  adjustment: { en: 'Balance adjustment', zh: '余额调整' },
  reversal: { en: 'Reversal', zh: '冲正' },
  compute: { en: 'Compute allocation', zh: '算力配置' },
  stocks: { en: 'Stock allocation', zh: '股票配置' },
  rwa: { en: 'RWA allocation', zh: 'RWA 配置' },
  order: { en: 'Order', zh: '订单' },
  wallet: { en: 'Wallet', zh: '钱包' },
  user: { en: 'Account', zh: '账户' },
  system: { en: 'System', zh: '系统' },
}

const IN_TYPES = new Set(['deposit', 'seed_deposit', 'withdrawal_refund', 'yield_distribution'])
const OUT_TYPES = new Set(['withdrawal_settlement', 'order_settlement', 'investment', 'seed_investment', 'redemption'])
const HOLD_TYPES = new Set(['withdrawal_lock', 'order_lock'])

function humanize(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function labelFor(value: string, locale: string) {
  const label = LEDGER_LABELS[value]
  if (!label) return locale.startsWith('zh') ? '账户变动' : 'Account change'
  return locale.startsWith('zh') ? label.zh : label.en
}

export function ledgerDisplay(transactionType: string | null | undefined, locale = 'en'): LedgerDisplay {
  const type = String(transactionType ?? '').trim().toLowerCase()
  const direction: DisplayDirection = IN_TYPES.has(type)
    ? 'in'
    : OUT_TYPES.has(type)
      ? 'out'
      : HOLD_TYPES.has(type)
        ? 'hold'
        : type === 'internal_transfer' || type === 'reversal'
          ? 'context'
          : 'context'
  const icon = direction === 'in'
    ? ArrowDownLeft
    : direction === 'out'
      ? ArrowUpRight
      : direction === 'hold'
        ? LockKeyhole
        : type === 'internal_transfer'
          ? ArrowLeftRight
          : CircleDollarSign
  return { label: labelFor(type, locale), icon, direction }
}

const CATEGORY_LABELS: Record<string, LabelSet> = {
  compute: { en: 'AI compute', zh: 'AI 算力' },
  stocks: { en: 'Stock basket', zh: '股票组合' },
  rwa: { en: 'Real-world assets', zh: '真实世界资产' },
  prediction: { en: 'Prediction market', zh: '预测市场' },
  ai: { en: 'AI strategy', zh: 'AI 策略' },
}

export function assetCategoryLabel(value: string | null | undefined, locale = 'en') {
  const key = String(value ?? '').trim().toLowerCase()
  const label = CATEGORY_LABELS[key]
  return label ? (locale.startsWith('zh') ? label.zh : label.en) : humanize(key || 'Asset')
}

export function assetDisplayName(value: string | null | undefined, locale = 'en') {
  const raw = String(value ?? '').trim()
  if (!raw) return locale.startsWith('zh') ? '未命名资产' : 'Unnamed asset'
  const key = raw.toLowerCase().replace(/[_\s]+/g, '-')
  if (CATEGORY_LABELS[key]) return assetCategoryLabel(key, locale)
  const knownNames: Record<string, string> = { 'anemoy-capital': 'Anemoy Capital' }
  if (knownNames[key]) return knownNames[key]
  return humanize(raw.toLowerCase())
}

export function shortId(value: string | null | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw) return '—'
  if (raw.length <= 12) return raw
  return `${raw.slice(0, 4)}…${raw.slice(-4)}`
}

function shortenIds(value: string) {
  return value.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, (match) => shortId(match))
}

export function notificationDisplay(item: { kind: string; title: string; body: string | null }, locale = 'en') {
  const source = `${item.title} ${item.body ?? ''}`
  const hasTechnicalCopy = /\b(?:demo|api|response|returned|seed)\b/i.test(source)
  const id = source.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0]
  if (hasTechnicalCopy) {
    const isOrder = item.kind.toLowerCase().includes('order')
    return {
      title: isOrder ? (locale.startsWith('zh') ? '订单状态更新' : 'Order update') : ledgerDisplay(item.kind, locale).label,
      body: id
        ? `${locale.startsWith('zh') ? '参考编号' : 'Reference'} ${shortId(id)}`
        : (locale.startsWith('zh') ? '有一条新的账户更新。' : 'There is a new account update.'),
    }
  }
  return {
    title: shortenIds(item.title),
    body: item.body ? shortenIds(item.body) : (locale.startsWith('zh') ? '暂无更多详情。' : 'No further details.'),
  }
}
