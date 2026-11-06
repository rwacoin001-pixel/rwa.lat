type GlowSnapshot = { phase: 'idle' | 'processing' | 'settling'; sequence: number }
const idle: GlowSnapshot = { phase: 'idle', sequence: 0 }
let snapshot = idle
const pending = new Set<symbol>()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined
const publish = (phase: GlowSnapshot['phase'], sequence = snapshot.sequence) => {
  snapshot = { phase, sequence }
  listeners.forEach(listener => listener())
}
export const transactionGlowSnapshot = () => snapshot
export const transactionGlowServerSnapshot = () => idle
export const subscribeTransactionGlow = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** Exact submission routes only: previews, quotes, address generation and reads never imply movement. */
export function isMoneyMutation(path: string, method: string): boolean {
  if (method.toUpperCase() !== 'POST') return false
  return /^\/v1\/(?:wallet\/(?:transfers|withdrawals)|orders|market\/orders|predictions\/bets|portfolio\/redemptions|(?:basket\/portfolios|quant\/products)\/[^/?]+\/(?:subscriptions|redemptions))$/.test(path.split('?')[0])
}

/** Cosmetic request feedback. It stores no amounts, identities, credentials or transaction results. */
export function beginTransactionGlow(): (accepted: boolean) => void {
  if (typeof window === 'undefined') return () => {}
  if (timer !== undefined) clearTimeout(timer)
  const key = Symbol('request')
  pending.add(key)
  publish('processing', snapshot.sequence + 1)
  return accepted => {
    if (!pending.delete(key) || pending.size) return
    if (!accepted) { publish('idle'); return }
    publish('settling')
    timer = setTimeout(() => { if (!pending.size) publish('idle') }, 1000)
  }
}

/** Called only for a newly observed, server-confirmed deposit credit. */
export function pulseTransactionGlow() { beginTransactionGlow()(true) }
