'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, X } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import q from './quant-strategy.module.css'

/** The Koala Quant film on the product page: plays from the help site (720p web copy), full screen, Back closes it. */
type StrategyCopy = { film: string; filmMeta: string; play: string; close: string }
const zh: StrategyCopy = {
  film: '考拉量化 · 策略影片',
  filmMeta: '4 分钟 · 讲清楚我们怎么做',
  play: '播放影片',
  close: '关闭',
}
const en: StrategyCopy = {
  film: 'Koala Quant · the film',
  filmMeta: '4 minutes · how we do it',
  play: 'Play the film',
  close: 'Close',
}

/** The film card (2026-10-29: the written method now lives in QuantResearch; this is the film alone). */
export function QuantFilm({ locale }: { locale: AppLocale }) {
  const t = locale === 'zh-CN' ? zh : en
  const lang = locale === 'zh-CN' ? 'zh' : 'en'
  const [playing, setPlaying] = useState(false)
  return <>
    <button type="button" className={q.film} onClick={() => setPlaying(true)} aria-label={t.play}>
      <img src={`/media/quant/film-${lang}.webp`} alt="" width={540} height={960} loading="lazy" decoding="async" />
      <span className={q.filmText}><b>{t.film}</b><small>{t.filmMeta}</small></span>
      <span className={q.play} aria-hidden="true"><Play size={18} fill="currentColor" strokeWidth={0} /></span>
    </button>
    {playing && <FilmPlayer src={`https://help.a-reit.com/media/koala-${lang}-720p.mp4`} poster={`/media/quant/film-${lang}.webp`} label={t.film} close={t.close} onClose={() => setPlaying(false)} />}
  </>
}

function FilmPlayer({ src, poster, label, close, onClose }: { src: string; poster: string; label: string; close: string; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const done = useRef(onClose)
  done.current = onClose
  useEffect(() => {
    // One history entry so the phone's Back closes the film, not the page.
    history.pushState({ ...(history.state ?? {}), rwaFilm: true }, '')
    const pop = () => done.current()
    window.addEventListener('popstate', pop)
    document.documentElement.setAttribute('data-photo-open', '')
    void video.current?.play().catch(() => undefined)
    return () => {
      window.removeEventListener('popstate', pop)
      document.documentElement.removeAttribute('data-photo-open')
    }
  }, [])
  const shut = () => { if (history.state?.rwaFilm) history.back(); else onClose() }
  return createPortal(<div className={q.player} role="dialog" aria-modal="true" aria-label={label}>
    <video ref={video} src={src} poster={poster} controls playsInline preload="metadata" />
    <button type="button" className={q.close} aria-label={close} onClick={shut}><X size={22} strokeWidth={2} /></button>
  </div>, document.body)
}
