'use client'

import { useSyncExternalStore } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import { getToast, subscribeToast } from '@/lib/toast-store'
import styles from './toast-host.module.css'

// Mounted once by the app shell; anything can call showToast() from lib/toast-store.
export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, getToast, () => null)
  if (!toast) return null
  const error = toast.tone === 'error'
  return <div key={toast.id} className={styles.toast} data-tone={toast.tone} role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'}>
    <span className={styles.icon} aria-hidden="true">{toast.tone === 'ok' ? <Check size={14} strokeWidth={2.4} /> : error ? <AlertTriangle size={14} strokeWidth={2.2} /> : <Info size={14} strokeWidth={2.2} />}</span>
    <span className={styles.text}>{toast.message}</span>
  </div>
}
