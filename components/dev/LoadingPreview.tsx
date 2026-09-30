'use client'

import { useState } from 'react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { useUiLoading } from '@/lib/use-ui-loading'
import AppLoading from '../app-loading'

export default function LoadingPreview() {
  const { theme, toggleTheme } = useRwaTheme()
  const [busy, setBusy] = useState(false)
  const [initial, setInitial] = useState(false)
  useUiLoading(busy)
  return <>
    <nav aria-label="加载效果预览" style={{ position: 'fixed', top: 18, left: 18, right: 18, zIndex: 11000, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button onClick={toggleTheme}>切换到{theme === 'light' ? '冷色' : '暖色'}</button>
      <button onClick={() => { setInitial(false); setBusy(value => !value) }}>{busy ? '结束加载' : '页内加载'}</button>
      <button onClick={() => { setBusy(false); setInitial(value => !value) }}>首次加载</button>
    </nav>
    {initial ? <AppLoading /> : <main style={{ minHeight: '100dvh', padding: '110px 24px 24px', background: theme === 'light' ? '#f4efe6' : '#070c16', color: theme === 'light' ? '#1b1813' : '#e9edf3' }}>
      <h1 style={{ fontSize: 28, fontWeight: 500 }}>RWA.LAT</h1>
      {[0, 1, 2].map(row => <div key={row} style={{ marginTop: 20, height: row === 0 ? 180 : 90, borderRadius: 18, background: theme === 'light' ? 'rgba(138,106,59,.10)' : 'rgba(169,184,208,.10)', border: '1px solid rgba(138,106,59,.14)' }} />)}
    </main>}
  </>
}
