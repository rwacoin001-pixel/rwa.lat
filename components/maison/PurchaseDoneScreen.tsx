'use client'

/**
 * `/purchase/done` — the success page after a purchase or a prediction (2026-11-05). Alipay / brokerage pattern: a tick
 * that draws itself, the amount, a short receipt (what, how much, when it starts, the order number), one main key
 * (done → where the money now shows) and two quiet ones (buy again · records). The receipt comes from the flow that
 * just finished (lib/purchase-done.ts); with none, the page goes home.
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { MaisonPage } from './primitives'
import { FlowSuccess } from './flow-kit'
import { openPath } from '@/lib/maison-nav'
import { readPurchaseDone, type PurchaseDone } from '@/lib/purchase-done'
import s from './purchase-done.module.css'

export function PurchaseDoneScreen() {
  const [record, setRecord] = useState<PurchaseDone | null | undefined>(undefined)
  useEffect(() => { const value = readPurchaseDone(); setRecord(value); if (!value) openPath('/home', { replace: true }) }, [])
  if (!record) return <MaisonPage page="purchase-done"><div className={s.blank} /></MaisonPage>
  return <MaisonPage page="purchase-done">
    <div className={s.page}>
      <button type="button" className={s.close} aria-label="Close" onClick={() => openPath(record.donePath, { replace: true })}><X size={22} strokeWidth={1.8} /></button>
      <FlowSuccess title={record.title} amount={record.amount} unit={record.unit} rows={record.rows} note={record.note}
        onDone={() => openPath(record.donePath, { replace: true })} onAgain={() => openPath(record.againPath, { replace: true })} onRecords={() => openPath(record.recordsPath, { replace: true })} />
    </div>
  </MaisonPage>
}
