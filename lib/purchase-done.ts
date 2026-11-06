'use client'

import { pathForScreen } from './rwa-routes'

/**
 * The "purchase done" page's data (2026-11-05, user: after buying, land on a success page, like mature apps). The buy
 * flow writes the receipt here just before it navigates to /purchase/done; the page reads it once. Session-only, never
 * the network: a reload of the page keeps the same receipt, a new tab does not.
 */
export type PurchaseKind = 'quant' | 'prediction' | 'basket'
export type PurchaseDone = {
  kind: PurchaseKind; title: string; amount: string; unit: string
  rows: Array<{ label: string; value: string }>; note?: string
  donePath: string; againPath: string; recordsPath: string; at: string
}
const KEY = 'rwa.purchase.done'
export const PURCHASE_DONE_PATH = '/purchase/done'

export function savePurchaseDone(record: Omit<PurchaseDone, 'at'>) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...record, at: new Date().toISOString() })) } catch { /* private mode: the page falls back */ }
}
export function readPurchaseDone(): PurchaseDone | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as PurchaseDone
    if (record?.kind === 'prediction' && record.recordsPath === '/my-predictions') {
      return { ...record, recordsPath: pathForScreen('my-predictions') }
    }
    return record
  } catch { return null }
}
