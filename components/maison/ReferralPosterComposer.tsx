'use client'
import { useEffect, useMemo, useRef, useState, type RefObject, type CSSProperties } from 'react'
import { Download, Share2, RotateCw, Maximize2, Minimize2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { localeOptions, type AppLocale } from '@/lib/app-locales'
import { getSessionToken, SESSION_CHANGED, SESSION_EXPIRED } from '@/lib/api/_http'
import type { ReferralSummary } from '@/lib/api/referral'
import { POSTER_PLATFORMS, buildPosterModel, invitationUrl, posterTemplates, posterPlatformName, type PosterModel, type PosterPlatform } from '@/lib/referral-poster'
import { posterCopy } from '@/lib/referral-poster-copy'
import { drawReferralPoster } from '@/lib/referral-poster-renderer'
import { ReferralSheet, type SheetTheme } from './ReferralSheet'
import { nativeCan, nativeSaveImage, nativeShare } from '@/lib/native-app'
import x from './referral-poster.module.css'

function PosterThumbnail({ model, qr }: { model: PosterModel; qr: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current, code = qr.current?.querySelector('canvas')
    let current = true
    if (canvas && code) {
      const staging = document.createElement('canvas')
      void drawReferralPoster(staging, model, code, 240).then(() => {
        if (!current) return
        canvas.width = staging.width; canvas.height = staging.height
        canvas.getContext('2d')?.drawImage(staging, 0, 0)
      }).catch(() => { if (current) canvas.width = 0 })
    }
    return () => { current = false }
  }, [model, qr])
  return <canvas ref={ref} className={x.thumbnail} aria-hidden="true" />
}

export function ReferralPosterComposer({ code, summary, locale, theme, inertRef, onClose, sourceReady = true, initialPlatform = 'wechat', initialIndex = 0, initialFullscreen = false }: {
  code: string; summary: ReferralSummary; locale: AppLocale; theme: SheetTheme
  inertRef: RefObject<HTMLElement | null>; onClose: () => void; sourceReady?: boolean
  initialPlatform?: PosterPlatform['id']; initialIndex?: number; initialFullscreen?: boolean
}) {
  const ui = posterCopy[locale]
  const [platformId, setPlatform] = useState<string>(initialPlatform), [index, setIndex] = useState(initialIndex)
  const [posterLocale, setPosterLocale] = useState<AppLocale>(locale)
  const [retry, setRetry] = useState(0), [status, setStatus] = useState(''), [error, setError] = useState('')
  const [output, setOutput] = useState<{ key: string; url: string; file: File } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [expanded, setExpanded] = useState(initialFullscreen)
  const qrRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null)
  const mounted = useRef(true), initialSession = useRef(getSessionToken()), run = useRef(0)
  const platform = POSTER_PLATFORMS.find(item => item.id === platformId)!
  const variants = useMemo(() => posterTemplates(platformId).map(template => {
    if (!sourceReady) return null
    try { return buildPosterModel({ code, locale: posterLocale, template, rules: summary.rules, purchaseRewardsEnabled: summary.purchaseRewardsEnabled, feeRewardsEnabled: summary.feeRewardsEnabled }) }
    catch { return null }
  }), [platformId, code, posterLocale, summary.rules, summary.purchaseRewardsEnabled, summary.feeRewardsEnabled, sourceReady])
  const selected = variants[index]
  const selection = JSON.stringify([code, platformId, index, posterLocale, summary.rules, summary.purchaseRewardsEnabled, summary.feeRewardsEnabled, sourceReady])
  const latest = useRef(selection); latest.current = selection
  const current = () => mounted.current && initialSession.current === getSessionToken()
  const closeRef = useRef(onClose); closeRef.current = onClose
  useEffect(() => {
    mounted.current = true
    const clear = () => { run.current++; closeRef.current() }
    window.addEventListener(SESSION_CHANGED, clear); window.addEventListener(SESSION_EXPIRED, clear)
    return () => { mounted.current = false; run.current++; window.removeEventListener(SESSION_CHANGED, clear); window.removeEventListener(SESSION_EXPIRED, clear) }
  }, [])
  useEffect(() => {
    const generation = ++run.current, canvas = canvasRef.current, qr = qrRef.current?.querySelector('canvas')
    let url: string | null = null, active = true
    setOutput(null); setStatus(''); setError('')
    if (!selected || !canvas || !qr) return
    const staging = document.createElement('canvas')
    void drawReferralPoster(staging, selected, qr).then(() => {
      if (!active || generation !== run.current || !current()) return
      canvas.width = staging.width; canvas.height = staging.height
      canvas.getContext('2d')?.drawImage(staging, 0, 0)
      staging.toBlob(blob => {
        if (!active || generation !== run.current || !current() || latest.current !== selection) return
        if (!blob) { setError(ui.failed); return }
        url = URL.createObjectURL(blob)
        setOutput({ key: selection, url, file: new File([blob], selected.filename, { type: 'image/png' }) })
      }, 'image/png')
    }).catch(() => { if (active && generation === run.current && current()) setError(ui.failed) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
    // Rendering and export are invalidated by every rule, code, account and selection change.
  }, [selected, selection, retry, ui.failed])
  const ready = !!selected && sourceReady && !!output && output.key === selection && current()
  // Inside the Android app (WebView: no file download, no Web Share) the app saves to the gallery and shares natively.
  const saveNative = () => {
    if (!ready || sharing || !output) return
    setSharing(true); setStatus('')
    void nativeSaveImage(output.file, output.file.name).then(result => {
      if (current()) { setSharing(false); setStatus(result.ok ? ui.savedPhoto : ui.saveFailed) }
    })
  }
  const share = () => {
    if (!ready || sharing || !output) return
    if (nativeCan('share')) {
      setSharing(true); setStatus('')
      void nativeShare({ title: 'A-REIT', url: invitationUrl(code), image: output.file, name: output.file.name }).then(result => {
        if (current()) { setSharing(false); if (!result.ok && result.reason === 'failed') setStatus(ui.shareHint) }
      })
      return
    }
    const files = [output.file]
    if (!navigator.share || !navigator.canShare?.({ files })) { setStatus(ui.shareHint); return }
    setSharing(true); setStatus('')
    // The file is prepared before the tap, preserving transient user activation on iOS.
    void navigator.share({ files, title: 'A-REIT' }).then(() => {
      if (current()) setSharing(false)
    }).catch((reason: unknown) => {
      if (current()) { setSharing(false); if (!(reason instanceof DOMException && reason.name === 'AbortError')) setStatus(ui.shareHint) }
    })
  }
  const poster = ready ? <img src={output!.url} alt={`${ui.preview} · ${posterPlatformName(platform, locale)} · ${selected!.styleName}`} width={platform.width} height={platform.height} /> : <div className={x.placeholder} role="status">{error || (!selected ? ui.unavailable : ui.preparing)}</div>
  return <ReferralSheet tall fullScreen title={expanded && selected ? selected.styleName : ui.title} closeLabel={ui.close} theme={expanded && selected ? selected.template.dark ? 'dark' : 'light' : theme} inertRef={inertRef} onClose={onClose}>
    <div className={`${x.composer} ${expanded ? x.fullscreenComposer : ''}`} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div ref={qrRef} className={x.qrSource} aria-hidden="true"><QRCodeCanvas value={invitationUrl(code)} size={512} marginSize={4} level="H" bgColor="#ffffff" fgColor="#000000" /></div>
      <canvas ref={canvasRef} className={x.outputCanvas} hidden aria-hidden="true" />
      {expanded ? <div className={x.fullscreenPreview} style={ready ? { '--poster-background': `url("${output!.url}")` } as CSSProperties : undefined}>{poster}</div> : <>
      <div className={x.heading}><span>{ui.platform}</span><label className={x.language}>{ui.language}<select value={posterLocale} onChange={e => setPosterLocale(e.target.value as AppLocale)}>{localeOptions.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label></div>
      <div className={x.platforms} role="group" aria-label={ui.platform}>{POSTER_PLATFORMS.map(item => <button key={item.id} type="button" aria-pressed={platformId === item.id} onClick={() => { setPlatform(item.id); setIndex(0) }}>{posterPlatformName(item, locale)}</button>)}</div>
      <div className={x.templateHeading}><span>{ui.templates} <small>{index + 1} / {variants.length}</small></span><small>{posterPlatformName(platform, locale)} · {platform.format}</small></div>
      <div className={x.templates} role="group" aria-label={ui.templates}>{variants.map((model, i) => <button type="button" key={posterTemplates(platformId)[i].id} className={x.template} disabled={!model} aria-pressed={index === i} aria-label={model ? `${model.styleName} · ${ui[model.template.kind]}` : ui.unavailable} onClick={() => setIndex(i)}>
        <span className={x.art} style={{ background: model?.template.dark ? '#101313' : '#f5f5f5' }}>{model && <PosterThumbnail model={model} qr={qrRef} />}</span>
        <span className={x.templateName}>{model?.styleName || ui.unavailable}</span>
        {model && <small className={x.templateKind}>{ui[model.template.kind]}</small>}
      </button>)}</div>
      <div className={x.preview} style={{ '--poster-ratio': platform.width / platform.height, aspectRatio: `${platform.width}/${platform.height}` } as CSSProperties} aria-busy={!!selected && !ready && !error}>
        {poster}
        {ready && <button type="button" className={x.expand} aria-label={ui.preview} onClick={() => setExpanded(true)}><Maximize2 size={18} /></button>}
      </div>
      </>}
      {error && <button type="button" className={x.retry} onClick={() => setRetry(v => v + 1)}><RotateCw size={16} />{ui.retry}</button>}
      <p className={x.status} role={error ? 'alert' : 'status'}>{status}</p>
      <div className={x.toolbar}>
        {expanded && <button type="button" className={x.collapse} aria-label={ui.templates} onClick={() => setExpanded(false)}><Minimize2 size={18} /></button>}
        <a className={x.save} href={ready ? output!.url : undefined} download={selected?.filename} aria-disabled={!ready} tabIndex={ready ? 0 : -1} onClick={event => { if (!ready || !current()) { event.preventDefault(); return } if (nativeCan('save-image')) { event.preventDefault(); saveNative(); return } setStatus(ui.saveHint) }}><Download size={18} />{ui.save}</a>
        <button type="button" className={x.share} disabled={!ready || sharing} onClick={share} aria-busy={sharing}><Share2 size={18} />{ui.share}</button>
      </div>
    </div>
  </ReferralSheet>
}
