'use client'

/**
 * The invitation plate (2026-10-29, docs/design-system.md §7.7). After React Bits' Reflective Card: a metal card that
 * catches the light as it tilts. No camera and no WebGL: the "reflection" is our own Marina Bay photo, blurred and
 * moving against the tilt, and the light is a CSS glare and one soft band. Tilt follows the finger on the card (and the
 * phone's tilt where the browser gives it without a prompt); it rises once on entry and rests flat otherwise.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { displayInviteCode } from '@/lib/referral-invite'
import p from './invite-plate.module.css'

type Translate = (cn: string, en: string) => string
const MAX_TILT = 9

/** The plate: the brand, the code in the open middle, how many friends joined, a small printed QR. */
export function InvitePlate({ code, link, invited, copied = false, onQr, onCopy, onEdit, t }: { code: string; link: string; invited: string; copied?: boolean; onQr: () => void; onCopy: () => void; onEdit: () => void; t: Translate }) {
  const { theme } = useRwaTheme()
  const shot = theme === 'dark' ? 'dark' : 'light'
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const [touched, setTouched] = useState(false)

  // Write the tilt as CSS variables in one animation frame; the card, the photo, the glare and the band read them.
  const tilt = (x: number, y: number) => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.style.setProperty('--rx', `${(-y * MAX_TILT).toFixed(2)}deg`)
      node.style.setProperty('--ry', `${(x * MAX_TILT).toFixed(2)}deg`)
      node.style.setProperty('--gx', `${(50 + x * 50).toFixed(1)}%`)
      node.style.setProperty('--gy', `${(50 + y * 50).toFixed(1)}%`)
      node.style.setProperty('--tx', x.toFixed(3))
      node.style.setProperty('--ty', y.toFixed(3))
    })
  }
  const rest = () => { setTouched(false); tilt(0, 0) }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Android gives the phone's tilt without asking; iOS needs a permission prompt, which we do not show for decoration.
    const Orientation = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined
    if (!Orientation || typeof Orientation.requestPermission === 'function') return
    let base: { b: number; g: number } | null = null
    const onTilt = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return
      base ??= { b: event.beta, g: event.gamma }
      const clamp = (v: number) => Math.max(-1, Math.min(1, v))
      tilt(clamp((event.gamma - base.g) / 20), clamp((event.beta - base.b) / 20))
    }
    window.addEventListener('deviceorientation', onTilt)
    return () => { window.removeEventListener('deviceorientation', onTilt); cancelAnimationFrame(frame.current) }
  }, [])

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = event.currentTarget.getBoundingClientRect()
    setTouched(true)
    tilt(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1)
  }

  return <div className={p.stage}>
    <div ref={ref} className={p.plate} data-theme={shot} data-touched={touched || undefined}
      onPointerMove={onMove} onPointerLeave={rest} onPointerCancel={rest} onPointerUp={rest}
      role="group" aria-label={t('我的邀请函', 'My invitation')} style={{ ['--photo' as string]: `url(/media/quant/cover-${shot}-ground.webp)` } as CSSProperties}>
      <i className={p.reflection} aria-hidden="true" />
      <i className={p.brush} aria-hidden="true" />
      <i className={p.band} aria-hidden="true" />
      <i className={p.glare} aria-hidden="true" />
      <div className={p.content}>
        <header className={p.head}>
          <span className={p.brand}><img src={`/brand/a-reit/mark-${shot === 'dark' ? 'dark' : 'light'}.svg`} alt="" width={14} height={16} /><span>A-REIT</span></span>
          <span className={p.kind}>INVITATION</span>
        </header>
        {/* Like a card (2026-10-29, user): the face is left open; the code sits bottom-left, printed into the metal,
            with the friends line under it; the QR bottom-right. Tapping the code copies the link. */}
        <footer className={p.foot}>
          <span className={p.footText}>
            <small>{t('邀请码', 'INVITATION CODE')}</small>
            <button type="button" className={p.code} onClick={onCopy} aria-label={t(`邀请码 ${code.toUpperCase()}，点按复制邀请链接`, `Invitation code ${code.toUpperCase()}, tap to copy the link`)}>
              <span dir="ltr">{displayInviteCode(code)}</span>
            </button>
            <span className={p.meta}>
              <span data-done={copied || undefined}>{copied ? t('链接已复制', 'Link copied') : invited}</span>
              <i aria-hidden="true">·</i>
              <button type="button" className={p.inline} aria-haspopup="dialog" onClick={onEdit}>{t('修改', 'Edit')}</button>
            </span>
          </span>
          {/* Printed on the metal: no white tile, the modules in the plate's ink (blended in, like an etching). */}
          <button type="button" className={p.qr} aria-label={t('放大邀请二维码', 'Enlarge invitation QR code')} aria-haspopup="dialog" onClick={onQr}>
            <QRCodeSVG value={link} size={72} marginSize={0} level="M" bgColor="transparent" fgColor="currentColor" title={t('邀请链接二维码', 'Invitation QR code')} />
          </button>
        </footer>
      </div>
      <i className={p.rim} aria-hidden="true" />
    </div>
  </div>
}
