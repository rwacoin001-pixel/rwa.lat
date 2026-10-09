'use client'

import { useEffect, useState } from 'react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { localeOptions } from '@/lib/app-locales'
import { useI18n } from '@/lib/i18n'
import { saveSession } from '@/lib/api/_http'
import { clearQueryCache } from '@/lib/api/_query'
import { ReceiveScreen, TransferScreen, WithdrawScreen } from '@/components/maison/FundsScreen'
import { SecurityScreen } from '@/components/maison/SecurityScreen'

type View = 'withdraw' | 'transfer' | 'receive' | 'security'
/** Only the dedicated local harness serves this page. All /v1 requests are answered by its in-memory mock;
 * the production build returns 404. No real account, database or financial service is involved. */
export default function FundsSecurityPreview() {
  const { theme, toggleTheme } = useRwaTheme()
  const { locale, setLocale } = useI18n()
  const [view, setView] = useState<View>('withdraw')
  const [ready, setReady] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (window.location.port !== '3044') return
    saveSession('local-funds-security-preview', { userId: '10000000-0000-4000-8000-000000000001', sessionId: '10000000-0000-4000-8000-000000000011' })
    setReady(true)
  }, [])
  const reset = async () => {
    await fetch('/v1/local-funds-qa/reset', { method: 'POST' })
    clearQueryCache(); setVersion(n => n + 1)
  }
  return <main className="rwa-shell"><div className="rwa-mobile" data-theme={theme} data-screen={view === 'security' ? 'security' : view}>
    <aside style={{ position: 'relative', zIndex: 80, background: 'var(--bg)', color: 'var(--ink)', borderBottom: '1px solid var(--edge)', padding: '10px 14px', fontSize: 12 }}>
      <p style={{ margin: '0 0 8px' }}>本地样例 · 不执行资金操作 · 验证器验证码 000000</p>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(['withdraw', 'transfer', 'receive', 'security'] as const).map(v => <button key={v} onClick={() => setView(v)} style={{ minHeight: 44 }} aria-pressed={view === v}>{({ withdraw: '提现', transfer: '转账', receive: '收款', security: '安全设置' })[v]}</button>)}
        <button onClick={toggleTheme} style={{ minHeight: 44 }}>◐</button>
        <select aria-label="Preview language" value={locale} onChange={e => setLocale(e.target.value as typeof locale)}>{localeOptions.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}</select>
        <button onClick={() => void reset()} style={{ minHeight: 44 }}>重置样例</button>
      </nav>
    </aside>
    {ready ? <div key={`${view}:${version}`}>
      {view === 'withdraw' ? <WithdrawScreen query="" /> : view === 'transfer' ? <TransferScreen query="to=10000000-0000-4000-8000-000000000002" /> : view === 'receive' ? <ReceiveScreen /> : <SecurityScreen />}
    </div> : <p style={{ padding: 24 }}>请使用独立的 3044 本地预览服务。</p>}
  </div></main>
}
