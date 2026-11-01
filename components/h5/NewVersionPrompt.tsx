'use client'

/**
 * Shell notices (2026-11-01, user: the offline notice could not be closed and was unreadable; the update notice looked
 * bad). One paper card under the status bar for both, inside the themed app so light and dark both read: a short title,
 * one line under it, and on the trailing side either the action (Update) or a 44px close key. No tinted icon tiles.
 */
import { X } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import styles from './shell-notice.module.css'

type Copy = { updateTitle: string; updateBody: string; update: string; later: string; offlineTitle: string; offlineBody: string; close: string }
const copy: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': { updateTitle: '有新版本', updateBody: '更新只需几秒，不会丢失内容。', update: '更新', later: '稍后', offlineTitle: '网络已断开', offlineBody: '恢复连接后会自动刷新数据。', close: '关闭' },
  en: { updateTitle: 'New version ready', updateBody: 'Updating takes a few seconds. Nothing is lost.', update: 'Update', later: 'Later', offlineTitle: 'You are offline', offlineBody: 'Data refreshes by itself when you are back online.', close: 'Close' },
}
const useCopy = () => { const { locale } = useI18n(); return copy[locale] ?? copy.en! }

export function NewVersionPrompt({ onUpdate, onLater }: { onUpdate: () => void; onLater: () => void }) {
  const k = useCopy()
  return <div className={styles.notice} role="status">
    <span className={styles.text}><b>{k.updateTitle}</b><small>{k.updateBody}</small></span>
    <button type="button" className={styles.ghost} onClick={onLater}>{k.later}</button>
    <button type="button" className={styles.action} onClick={onUpdate}>{k.update}</button>
  </div>
}

export function ConnectionBanner({ onClose }: { onClose: () => void }) {
  const k = useCopy()
  return <div className={styles.notice} data-tone="offline" role="status">
    <i className={styles.dot} aria-hidden="true" />
    <span className={styles.text}><b>{k.offlineTitle}</b><small>{k.offlineBody}</small></span>
    <button type="button" className={styles.close} onClick={onClose} aria-label={k.close}><X size={18} strokeWidth={2} aria-hidden="true" /></button>
  </div>
}
