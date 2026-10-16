'use client'
import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { ReferralPosterComposer } from '@/components/maison/ReferralPosterComposer'
import type { ReferralSummary } from '@/lib/api/referral'
import { POSTER_PLATFORMS, posterTemplates, buildPosterModel, invitationUrl, type PosterPlatform } from '@/lib/referral-poster'
import { drawReferralPoster } from '@/lib/referral-poster-renderer'
import { localeOptions, type AppLocale } from '@/lib/app-locales'

const summary: ReferralSummary = {
  stage: 1, payoutsEnabled: true, purchaseRewardsEnabled: true, feeRewardsEnabled: true, currency: 'USDT', decimals: 6,
  balances: { available: '0', claimed: '0', total: '0' }, levels: [],
  rules: { version: 2, effectiveAt: { fee: '', holding: '', team: '' }, holdingRatesBps: [600, 300, 100], feeRatesBps: [2000, 1000, 500], teamTiers: [] },
}
export default function ReferralPosterPreview() {
  const root = useRef<HTMLDivElement>(null), qr = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false), [locale, setLocale] = useState<AppLocale>('zh-CN'), [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [code, setCode] = useState('Preview26'), [sourceReady, setReady] = useState(true)
  const [result, setResult] = useState<unknown>(null), [busy, setBusy] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [galleryPlatform, setGalleryPlatform] = useState<PosterPlatform['id']>('xiaohongshu')
  const [initialIndex, setInitialIndex] = useState(0), [initialFullscreen, setInitialFullscreen] = useState(false)
  const [gallery, setGallery] = useState<Array<{ id: string; title: string; url: string; width: number; height: number }>>([])
  const [galleryError, setGalleryError] = useState('')
  useEffect(() => {
    let active = true
    setGallery([]); setGalleryError('')
    const qrCanvas = qr.current?.querySelector('canvas')
    if (!qrCanvas) return
    void Promise.all(posterTemplates(galleryPlatform).map(async template => {
      const model = buildPosterModel({ code: 'Preview26', locale, template, rules: summary.rules, purchaseRewardsEnabled: true, feeRewardsEnabled: true })
      const canvas = document.createElement('canvas')
      await drawReferralPoster(canvas, model, qrCanvas, 600)
      return { id: template.id, title: model.styleName, url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
    })).then(rows => { if (active) setGallery(rows) }).catch(error => { if (active) setGalleryError(String(error)) })
    return () => { active = false }
  }, [galleryPlatform, locale])
  async function sweep() {
    const codeCanvas = qr.current?.querySelector('canvas')
    if (!codeCanvas) return
    setBusy(true); setResult(null)
    const results: Array<Record<string, unknown>> = []
    const canvas = document.createElement('canvas')
    try {
      for (const language of localeOptions) for (const platform of POSTER_PLATFORMS) for (const template of posterTemplates(platform.id)) {
        try {
          const model = buildPosterModel({ code: 'Preview26', locale: language.code, template, rules: summary.rules, purchaseRewardsEnabled: true, feeRewardsEnabled: true })
          const layout = await drawReferralPoster(canvas, model, codeCanvas)
          const footer = layout.bounds.find(box => box.name === 'disclaimer')
          results.push({ locale: language.code, template: template.id, ok: true, width: layout.width, height: layout.height, disclaimerSize: footer?.size })
        } catch (error) { results.push({ locale: language.code, template: template.id, ok: false, error: String(error) }) }
      }
      setResult({ count: results.length, failures: results.filter(row => !row.ok), results })
    } finally { canvas.width = 0; canvas.height = 0; setBusy(false) }
  }
  return <>
    <div ref={root} style={{ maxWidth: 1240, margin: 'auto', padding: 24, color: '#e4ece8', background: '#111718', minHeight: '100dvh', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 24 }}>A-REIT · 推荐海报</h1>
      <p style={{ color: '#aab8b0', fontSize: 12 }}>六款抽象建筑海报 · 示例邀请码 Preview26</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <label>界面语言 <select value={locale} onChange={e => setLocale(e.target.value as AppLocale)}>{localeOptions.map(row => <option key={row.code} value={row.code}>{row.label}</option>)}</select></label>
        <label>主题 <select value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark')}><option value="light">浅色</option><option value="dark">深色</option></select></label>
        <label>平台尺寸 <select value={galleryPlatform} onChange={e => setGalleryPlatform(e.target.value as PosterPlatform['id'])}>{POSTER_PLATFORMS.map(platform => <option key={platform.id} value={platform.id}>{platform.label} · {platform.format}</option>)}</select></label>
        <button type="button" disabled={!/^[a-zA-Z0-9]{6,16}$/.test(code)} onClick={() => { setInitialIndex(0); setInitialFullscreen(false); setOpen(true) }} style={{ minHeight: 48 }}>生成推荐海报</button>
      </div>
      <div ref={qr} hidden><QRCodeCanvas value={invitationUrl('Preview26')} size={512} marginSize={4} level="H" /></div>
      {galleryError && <p role="alert">{galleryError}</p>}
      <div data-testid="poster-gallery" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 24, margin: '32px -24px 0' }}>
        {gallery.map((poster, index) => <figure key={poster.id} style={{ margin: 0 }}><button type="button" aria-label={`${poster.title} · 全屏预览`} onClick={() => { setInitialIndex(index); setInitialFullscreen(true); setOpen(true) }} style={{ width: '100%', display: 'block', padding: 0, border: 0, cursor: 'zoom-in', background: 'transparent' }}><img src={poster.url} width={poster.width} height={poster.height} alt={poster.title} style={{ width: '100%', height: 'auto', display: 'block' }} /></button><figcaption style={{ fontSize: 13, padding: '12px 24px 0', color: '#c8d3ce' }}>{poster.title}</figcaption></figure>)}
      </div>
      <details style={{ marginTop: 24, color: '#b2beb7', fontSize: 12 }}>
        <summary style={{ minHeight: 44, cursor: 'pointer' }}>预览验证设置</summary>
        <p>示例账号与规则仅用于界面和导出验证，不代表实际邀请或奖励。</p>
        <label>示例邀请码 <input value={code} maxLength={16} onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} /></label>
        <label><input type="checkbox" checked={sourceReady} onChange={e => setReady(e.target.checked)} />规则已加载</label>
        <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />买入和手续费奖励已开启</label>
        <button type="button" disabled={busy} onClick={() => void sweep()} style={{ minHeight: 48, width: '100%', marginBottom: 72 }}>{busy ? '检查中' : '检查全部 420 个语言模板'}</button>
        {result !== null && <pre data-testid="sweep-result" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>{JSON.stringify(result, null, 2)}</pre>}
      </details>
    </div>
    {open && <ReferralPosterComposer key={code} code={code} summary={{ ...summary, purchaseRewardsEnabled: enabled, feeRewardsEnabled: enabled }} locale={locale} theme={theme} inertRef={root} sourceReady={sourceReady} initialPlatform={galleryPlatform} initialIndex={initialIndex} initialFullscreen={initialFullscreen} onClose={() => setOpen(false)} />}
  </>
}
