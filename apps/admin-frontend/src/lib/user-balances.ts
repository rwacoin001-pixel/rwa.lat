export type AdjustmentMode = 'credit' | 'debit' | 'set'
export type AdjustmentBody = { operationId: string; mode: AdjustmentMode; amount: string; expectedAtomicBalance: string; reason: string }
const scale = BigInt(1000000)

export function formatUsdt(value: string | null | undefined): string {
  if (value === null || value === undefined) return '不可用'
  const amount = BigInt(value)
  const absolute = amount < BigInt(0) ? -amount : amount
  const whole = (absolute / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = (absolute % scale).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0')
  return `${amount < BigInt(0) ? '−' : ''}${whole}.${fraction}`
}

export function previewAdjustment(mode: AdjustmentMode, amount: string, before: string | null, reason: string) {
  if (before === null) throw new Error('余额不可用，请刷新。')
  if (!/^(0|[1-9]\d{0,71})(?:\.\d{1,6})?$/.test(amount)) throw new Error('金额最多支持 6 位小数。')
  if (reason.trim().length < 3 || reason.trim().length > 240) throw new Error('请填写 3–240 个字的调整原因。')
  const [whole, fraction = ''] = amount.split('.')
  const atomic = BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'))
  if (mode !== 'set' && atomic === BigInt(0)) throw new Error('调整金额必须大于零。')
  const delta = mode === 'set' ? atomic - BigInt(before) : mode === 'credit' ? atomic : -atomic
  const after = BigInt(before) + delta
  if (after < BigInt(0)) throw new Error('扣减金额超过可用余额。')
  if (after.toString().length > 78) throw new Error('金额过大。')
  if (delta === BigInt(0)) throw new Error('目标余额与当前余额相同。')
  return { before, after: after.toString(), delta: delta.toString() }
}
