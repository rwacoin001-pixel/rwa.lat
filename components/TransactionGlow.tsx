'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { subscribeTransactionGlow, transactionGlowSnapshot, transactionGlowServerSnapshot } from '@/lib/transaction-glow'
import s from './transaction-glow.module.css'

export default function TransactionGlow() {
  const state = useSyncExternalStore(subscribeTransactionGlow, transactionGlowSnapshot, transactionGlowServerSnapshot)
  if (state.phase === 'idle' || typeof document === 'undefined') return null
  return createPortal(<div className={s.root} key={state.sequence} data-transaction-glow={state.phase} aria-hidden="true">
    <div className={s.veil} /><i className={s.coral} /><i className={s.gold} /><i className={s.mint} />
    <div className={s.particles}>{Array.from({ length: 12 }, (_, index) => <span key={index} style={{ left: `${12 + index * 7}%`, animationDelay: `${-(index * .37)}s`, animationDuration: `${3.6 + index % 4 * .4}s` }} />)}</div>
  </div>, document.body)
}
