'use client'

/**
 * Share a result card off-site (2026-11-01). One sheet: the poster (1080×1920 — the same ticket card drawn on canvas from
 * the same model as the in-app card, the A-REIT logo, the slogan and a QR code that is the author's invite link), two
 * keys (save image, share), and a public link that can be copied and closed again. Hidden fields stay hidden: the poster
 * draws only what the server sent. Circle-only posts never reach here.
 */
import { Download, Link2, Share2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from '@/components/maison/Sheet'
import { request } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { referralMe } from '@/lib/api/referral'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { nativeCan, nativeSaveImage, nativeShare } from '@/lib/native-app'
import { inviteLinkFor } from '@/lib/referral-invite'
import type { CommunityPost } from '@/lib/community-data'
import { describeCard, useResultCardCopy, type Author, type CardModel } from './ResultCard'
import s from './card-share.module.css'

type Copy = { title: string; save: string; share: string; saved: string; link: string; copy: string; copied: string; revoke: string; revoked: string; failed: string; slogan: string; scan: string; drawing: string }
const copy: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': { title: '分享卡片', save: '保存图片', share: '分享', saved: '已保存', link: '分享链接', copy: '复制链接', copied: '链接已复制', revoke: '关闭链接', revoked: '链接已关闭，打开会显示「分享已关闭」', failed: '没有成功，请稍后再试。', slogan: '让资产清晰起来', scan: '扫码加入 A-REIT', drawing: '正在生成图片…' },
  en: { title: 'Share card', save: 'Save image', share: 'Share', saved: 'Saved', link: 'Share link', copy: 'Copy link', copied: 'Link copied', revoke: 'Close link', revoked: 'Link closed. It now shows "sharing closed".', failed: 'That did not work. Please try again.', slogan: 'Bring Assets Into Focus.', scan: 'Scan to join A-REIT', drawing: 'Drawing the image…' },
}

export function CardShareSheet({ post, open, onClose }: { post: CommunityPost; open: boolean; onClose: () => void }) {
  const { locale } = useI18n()
  const k = copy[locale] ?? copy.en!
  const rc = useResultCardCopy()
  const code = useQuery(open ? 'referral:v2:me' : null, referralMe, { staleTime: 300_000 }).data?.code ?? null
  const invite = inviteLinkFor(`/community/post/${encodeURIComponent(post.id)}`, code)
  const model = useMemo(() => post.card ? describeCard(post.card, rc, locale) : null, [post.card, rc, locale])
  const qrRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [note, setNote] = useState('')
  const [share, setShare] = useState<{ id: string; url: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !model) return
    let live = true, url = ''
    setImage(null)
    const timer = setTimeout(() => {
      const qr = qrRef.current?.querySelector('canvas')
      if (!qr) return
      void drawPoster(model, post.author ?? null, qr, k).then((blob) => { if (!live) return; url = URL.createObjectURL(blob); setImage({ blob, url }) }).catch(() => live && setNote(k.failed))
    }, 60)
    return () => { live = false; clearTimeout(timer); if (url) URL.revokeObjectURL(url) }
  }, [open, model, invite, post.author, k])

  const name = `a-reit-card-${post.id}.png`
  const save = async () => {
    if (!image) return
    if (nativeCan('save-image')) { const result = await nativeSaveImage(image.blob, name); if (result.ok) setNote(k.saved); return }
    const a = document.createElement('a'); a.href = image.url; a.download = name; a.click(); setNote(k.saved)
  }
  const shareImage = async () => {
    if (!image) return
    const link = share?.url ?? invite
    if (nativeCan('share')) { await nativeShare({ title: model?.head ?? 'A-REIT', url: link, image: image.blob, name }); return }
    const file = new File([image.blob], name, { type: 'image/png' })
    try { if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], url: link }); else if (navigator.share) await navigator.share({ url: link }); else void save() } catch { /* closed */ }
  }
  const makeLink = async () => {
    if (busy) return
    setBusy(true); setNote('')
    try {
      const result = await request<{ id: string; token: string }>('/v1/shares', { method: 'POST', body: JSON.stringify({ kind: 'community_card', resourceId: post.id }) })
      if (!result.ok) { setNote(k.failed); return }
      const url = `${window.location.origin}/share/${encodeURIComponent(result.data.token)}`
      setShare({ id: result.data.id, url })
      try { await navigator.clipboard.writeText(url); setNote(k.copied) } catch { /* shown below */ }
    } finally { setBusy(false) }
  }
  const revoke = async () => {
    if (!share || busy) return
    setBusy(true)
    try { const result = await request(`/v1/shares/${encodeURIComponent(share.id)}/revoke`, { method: 'POST' }); if (result.ok) { setShare(null); setNote(k.revoked) } else setNote(k.failed) } finally { setBusy(false) }
  }

  return <Sheet open={open} onClose={onClose} title={k.title}>
    <div className={s.wrap}>
      <div className={s.poster}>{image ? <img src={image.url} alt={model?.head ?? ''} /> : <span className={s.drawing}>{k.drawing}</span>}</div>
      <div className={s.keys}>
        <button type="button" className={s.key} disabled={!image} onClick={() => void save()}><Download size={18} aria-hidden="true" />{k.save}</button>
        <button type="button" className={`${s.key} ${s.solid}`} disabled={!image} onClick={() => void shareImage()}><Share2 size={18} aria-hidden="true" />{k.share}</button>
      </div>
      <div className={s.linkRow}>
        <span><b>{k.link}</b>{share && <small dir="ltr">{share.url}</small>}</span>
        {share ? <button type="button" className={s.textKey} disabled={busy} onClick={() => void revoke()}>{k.revoke}</button>
          : <button type="button" className={s.textKey} disabled={busy} onClick={() => void makeLink()}><Link2 size={16} aria-hidden="true" />{k.copy}</button>}
      </div>
      <p className={s.note} role="status" aria-live="polite">{note}</p>
      <div ref={qrRef} className={s.qrSource} aria-hidden="true"><QRCodeCanvas value={invite || 'https://a-reit.com'} size={360} marginSize={2} level="M" bgColor="#ffffff" fgColor="#0b1220" /></div>
    </div>
  </Sheet>
}

/* ── The poster: 1080×1920, drawn from the card model ── */
const BANDS = { quant: ['#c9efe0', '#d6e6f7', '#0b3b33'], prediction: ['#e2dcf8', '#f4d9e2', '#2e2448'], funds: ['#eceef1', '#e3e6ea', '#2b3340'] } as const
const TONE = { up: '#0f8f5f', down: '#c23a3a', flat: '#0b1220' } as const
const font = (size: number, weight = 500) => `${weight} ${size}px Satoshi, -apple-system, "SF Pro Display", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif`
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src })

function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) {
  g.beginPath(); g.roundRect(x, y, w, h, r)
}
function fit(g: CanvasRenderingContext2D, text: string, width: number) {
  if (g.measureText(text).width <= width) return text
  let t = text
  while (t.length > 1 && g.measureText(`${t}…`).width > width) t = t.slice(0, -1)
  return `${t}…`
}
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lh: number, max: number) {
  const units = /[　-鿿]/.test(text) ? [...text] : text.split(/(\s+)/)
  let line = '', n = 0
  for (const unit of units) {
    const next = line + unit
    if (g.measureText(next).width > width && line) { if (n === max - 1) { g.fillText(fit(g, line + unit, width), x, y + n * lh); return y + (n + 1) * lh } g.fillText(line.trimEnd(), x, y + n * lh); n++; line = unit.trimStart() } else line = next
  }
  if (line) { g.fillText(line, x, y + n * lh); n++ }
  return y + n * lh
}

async function drawPoster(m: CardModel, author: Author | null, qr: HTMLCanvasElement, k: Copy): Promise<Blob> {
  await document.fonts?.ready
  const W = 1080, H = 1920, c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const [bandA, bandB, bandInk] = BANDS[m.group]
  // Page: white with a faint glow of the kind's colour behind the card.
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W / 2, 760, 40, W / 2, 760, 760); glow.addColorStop(0, bandA + 'aa'); glow.addColorStop(1, '#ffffff00')
  g.fillStyle = glow; g.fillRect(0, 0, W, H)

  // Measure the card body first so the card can be centred.
  const X = 72, CW = W - X * 2, P = 18, inner = CW - P * 2, well = X + P, wellPad = 44
  const gridRows = Math.ceil(m.grid.length / 2)
  const heroH = (m.title ? 66 : 0) + (m.hero ? (m.hero.kicker ? 44 : 0) + 112 + (m.hero.sub ? 56 : 0) : 0) + (m.dots.length ? 60 : 0) + (m.holdings ? 76 + m.holdings.length * 66 : 0) + (m.open ? 44 : 0)
  const gridH = gridRows ? 24 + gridRows * 108 : 0
  const wellH = wellPad * 2 + heroH + gridH
  const footH = (author ? 108 : 0) + 44 + (m.funds ? 36 : 0) + 76
  const CH = P + 124 + 36 + wellH + footH + P
  const Y = Math.max(140, (1460 - CH) / 2)

  // Shell
  g.save(); g.shadowColor = 'rgba(15,23,42,.18)'; g.shadowBlur = 80; g.shadowOffsetY = 40
  round(g, X, Y, CW, CH, 64); g.fillStyle = '#ffffff'; g.fill(); g.restore()
  round(g, X, Y, CW, CH, 64); g.strokeStyle = 'rgba(11,18,32,.07)'; g.lineWidth = 2; g.stroke()
  // Ticket head
  const band = g.createLinearGradient(well, 0, well + inner, 0); band.addColorStop(0, bandA); band.addColorStop(1, bandB)
  round(g, well, Y + P, inner, 124, [48, 48, 18, 18]); g.fillStyle = band; g.fill()
  g.fillStyle = bandInk; g.font = font(34, 600); g.textBaseline = 'middle'
  g.fillText(fit(g, m.head, inner - 300), well + 36, Y + P + 62)
  g.font = font(28, 600); const pill = 'A-REIT', pw = g.measureText(pill).width + 48
  round(g, well + inner - pw - 28, Y + P + 34, pw, 56, 28); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill(); g.fillStyle = bandInk; g.fillText(pill, well + inner - pw - 4, Y + P + 63)
  // Perforation
  const py = Y + P + 124 + 18
  g.setLineDash([10, 10]); g.strokeStyle = 'rgba(11,18,32,.14)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X + 44, py); g.lineTo(X + CW - 44, py); g.stroke(); g.setLineDash([])
  g.fillStyle = '#ffffff'; for (const cx of [X, X + CW]) { g.beginPath(); g.arc(cx, py, 16, 0, Math.PI * 2); g.fill() }
  // Well
  const wy = Y + P + 124 + 36
  round(g, well, wy, inner, wellH, [18, 18, 48, 48]); g.fillStyle = '#f6f7f9'; g.fill()
  let y = wy + wellPad, x = well + wellPad, ww = inner - wellPad * 2
  g.textBaseline = 'alphabetic'
  if (m.title) { g.fillStyle = '#0b1220'; g.font = font(36, 600); g.fillText(fit(g, m.title, ww), x, y + 40); y += 66 }
  if (m.hero) {
    if (m.hero.kicker) { g.fillStyle = '#5b6472'; g.font = font(30); g.fillText(m.hero.kicker, x, y + 32); y += 44 }
    g.fillStyle = TONE[m.hero.tone]; g.font = font(96, 700); const t = fit(g, m.hero.text, ww - 160); g.fillText(t, x - 4, y + 92)
    if (m.hero.unit) { const tw = g.measureText(t).width; g.fillStyle = '#5b6472'; g.font = font(36, 500); g.fillText(m.hero.unit, x + tw + 14, y + 92) }
    y += 112
    if (m.hero.sub) { g.fillStyle = TONE[m.hero.subTone ?? 'flat']; g.font = font(42, 600); g.fillText(m.hero.sub, x, y + 42); y += 56 }
  }
  if (m.dots.length) { m.dots.forEach((d, i) => { const cx = x + 16 + i * 52, cy = y + 30; g.beginPath(); if (d === 'void') { g.fillStyle = '#5b6472'; g.fillRect(cx - 14, cy - 3, 28, 6) } else { g.arc(cx, cy, 15, 0, Math.PI * 2); if (d === 'won') { g.fillStyle = '#0b1220'; g.fill() } else { g.strokeStyle = '#0b1220'; g.lineWidth = 4; g.stroke() } } }); y += 60 }
  if (m.holdings) {
    const colours = ['#0f5c52', '#2fae93', '#9aa3ae', '#c8ced6'], total = m.holdings.reduce((a, b) => a + b.share, 0) || 1
    let bx = x; g.save(); round(g, x, y, ww, 56, 28); g.clip()
    m.holdings.forEach((h, i) => { const bw = ww * h.share / total; g.fillStyle = colours[i % 4]; g.fillRect(bx, y, bw - 4, 56); if (h.share >= 14) { g.fillStyle = '#fff'; g.font = font(26, 600); g.fillText(`${Math.round(h.share)}%`, bx + bw / 2 - 26, y + 38) } bx += bw })
    g.restore(); y += 76
    m.holdings.forEach((h, i) => { g.fillStyle = colours[i % 4]; g.beginPath(); g.arc(x + 8, y + 30, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0b1220'; g.font = font(30, 500); g.fillText(fit(g, h.product, ww - 160), x + 32, y + 40); g.font = font(30, 600); const tt = `${Math.round(h.share)}%`; g.fillText(tt, x + ww - g.measureText(tt).width, y + 40); y += 66 })
  }
  if (m.open) { g.fillStyle = '#5b6472'; g.font = font(28); g.fillText('·', x, y + 30); y += 44 }
  if (gridRows) {
    y += 8; g.fillStyle = 'rgba(11,18,32,.08)'; g.fillRect(x, y, ww, 2); y += 16
    const colW = ww / 2
    m.grid.forEach((cell, i) => {
      const cx = x + (i % 2) * colW + (i % 2 ? 32 : 0), cy = y + Math.floor(i / 2) * 108
      if (i % 2) { g.fillStyle = 'rgba(11,18,32,.08)'; g.fillRect(x + colW, cy + 10, 2, 88) }
      g.fillStyle = '#5b6472'; g.font = font(26); g.fillText(cell.label, cx, cy + 38)
      if (cell.hidden) { round(g, cx, cy + 62, 170, 22, 11); g.fillStyle = 'rgba(11,18,32,.09)'; g.fill() }
      else { g.fillStyle = TONE[cell.tone ?? 'flat']; g.font = font(32, 600); g.fillText(fit(g, cell.value, colW - 48), cx, cy + 86) }
    })
  }
  // Footer
  let fy = wy + wellH + 40
  const fx = X + 44, fw = CW - 88
  if (author) {
    g.fillStyle = '#e6ecf2'; g.beginPath(); g.arc(fx + 34, fy + 40, 34, 0, Math.PI * 2); g.fill()
    if (author.avatarUrl) { try { const img = await loadImage(author.avatarUrl); g.save(); g.beginPath(); g.arc(fx + 34, fy + 40, 34, 0, Math.PI * 2); g.clip(); g.drawImage(img, fx, fy + 6, 68, 68); g.restore() } catch { /* initials ring stays */ } }
    g.fillStyle = '#0b1220'; g.font = font(32, 600); g.fillText(fit(g, author.displayName, fw - 120), fx + 88, fy + 32)
    g.fillStyle = '#5b6472'; g.font = font(26); g.fillText(`@${author.handle}`, fx + 88, fy + 70); fy += 108
  }
  g.fillStyle = '#5b6472'; g.font = font(26); g.fillText(fit(g, m.provenance, fw), fx, fy + 26); fy += 44
  if (m.funds) { g.fillStyle = '#8a9099'; g.font = font(22); g.fillText(m.funds, fx, fy + 22); fy += 36 }
  g.fillStyle = '#8a9099'; g.font = font(22); wrap(g, m.risk, fx, fy + 24, fw, 32, 2)

  // Brand row: logo + slogan on the left, the QR on the right.
  const by = 1560
  try { const logo = await loadImage('/brand/a-reit/logo-light.svg'); const lh = 92, lw = logo.width / logo.height * lh; g.drawImage(logo, 96, by, lw, lh) } catch { g.fillStyle = '#0b1220'; g.font = font(64, 700); g.fillText('A-REIT', 96, by + 70) }
  g.fillStyle = '#0b1220'; g.font = font(44, 600); g.fillText(k.slogan, 96, by + 176)
  g.fillStyle = '#ffffff'; round(g, W - 96 - 236, by - 20, 236, 236, 28); g.fill(); g.strokeStyle = 'rgba(11,18,32,.08)'; g.lineWidth = 2; g.stroke()
  g.drawImage(qr, W - 96 - 218, by - 2, 200, 200)
  g.fillStyle = '#5b6472'; g.font = font(26); const sw = g.measureText(k.scan).width; g.fillText(k.scan, W - 96 - 118 - sw / 2, by + 260)
  return new Promise((resolve, reject) => c.toBlob((blob) => blob ? resolve(blob) : reject(new Error('blob')), 'image/png'))
}
