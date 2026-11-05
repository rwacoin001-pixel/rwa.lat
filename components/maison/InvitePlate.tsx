'use client'

/**
 * The invitation plate v2 (2026-11-05, user: no icon in the middle, a rounded QR, re-laid out, and the card turns over on
 * a tap with premium motion; the back explains my level and its perks. Reviewed with Codex).
 * - Front: the metal face left open; the brand top-left, a quiet "active" dot top-right; my name large with the level
 *   pressed into the metal beside it; the code with 修改 next to it, the friends line under; a rounded QR bottom-right.
 * - Back: my level large, star power and the bar to the next level, what is still missing (all the rules, not only the
 *   score), up to three live perks with the rest on one quiet line, a way to every level.
 * - Motion: the card follows the finger / phone tilt as before (outer layer); a tap turns it (inner layer) in 600 ms on a
 *   calm curve with no bounce — it lifts 4px and grows 1% at the middle, one faint reflection crosses the face. Buttons on
 *   the card never turn it, a scroll never turns it, the hidden face is inert, and a focusable key turns it by keyboard.
 *   Reduced motion: a short cross-fade instead.
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { displayInviteCode } from '@/lib/referral-invite'
import { useCommunityMe } from '@/lib/use-community-me'
import { useQuery } from '@/lib/api/_query'
import { membershipQuery } from '@/lib/api/membership'
import { giftsOf, membershipCopy } from '@/lib/membership-copy'
import { useI18n } from '@/lib/i18n'
import { openPath } from '@/lib/maison-nav'
import { RoundQr } from './RoundQr'
import p from './invite-plate.module.css'

type Translate = (cn: string, en: string) => string
const MAX_TILT = 9

export function InvitePlate({ code, link, invited, copied = false, onQr, onCopy, onEdit, t }: { code: string; link: string; invited: string; copied?: boolean; onQr: () => void; onCopy: () => void; onEdit: () => void; t: Translate }) {
  const { theme } = useRwaTheme()
  const { locale } = useI18n()
  const k = membershipCopy(locale)
  const shot = theme === 'dark' ? 'dark' : 'light'
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const press = useRef<{ x: number; y: number } | null>(null)
  const [touched, setTouched] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [turning, setTurning] = useState(false)

  // Write the tilt as CSS variables in one animation frame; paused while the card turns.
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
    })
  }
  const rest = () => { setTouched(false); tilt(0, 0) }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
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
    if (turning || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = event.currentTarget.getBoundingClientRect()
    setTouched(true)
    tilt(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1)
  }

  const turn = () => {
    if (turning) return
    setTurning(true); rest()
    setFlipped((v) => !v)
    try { navigator.vibrate?.(8) } catch { /* no haptics */ }
    window.setTimeout(() => setTurning(false), 620)
  }
  // A tap turns the card; a drag (scroll) or a tap on a key on the card does not.
  const onDown = (event: React.PointerEvent) => { press.current = { x: event.clientX, y: event.clientY } }
  const onUp = (event: React.PointerEvent) => {
    const start = press.current; press.current = null
    rest()
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return
    if ((event.target as HTMLElement).closest('button, a, input')) return
    turn()
  }

  const me = useCommunityMe(false)
  const galaxy = useQuery('membership:me', membershipQuery, { staleTime: 60_000, loading: 'silent' }).data
  const name = me?.displayName?.trim() || t('A-REIT 会员', 'A-REIT member')
  const level = galaxy?.level.index ?? null
  const num = (v: string | number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(v) || 0)
  const current = galaxy?.levels.find((row) => row.index === galaxy.level.index)
  const next = galaxy?.next ? galaxy.levels.find((row) => row.index === galaxy.next!.index) : undefined
  const score = Number(galaxy?.score ?? 0)
  const from = Number(current?.threshold ?? 0), to = Number(next?.threshold ?? from)
  const progress = next ? Math.max(0, Math.min(1, (score - from) / Math.max(1, to - from))) : 1
  const missing = galaxy?.next ? [
    ...(Number(galaxy.next.missing.score) > 0 ? [k.needScore(num(galaxy.next.missing.score))] : []),
    ...(galaxy.next.missing.firstDeposit ? [k.needDeposit] : []),
    ...(galaxy.next.missing.directActive ? [k.needDirect(galaxy.next.missing.directActive)] : []),
    ...(galaxy.next.missing.teamActive ? [k.needTeam(galaxy.next.missing.teamActive)] : []),
  ] : []
  const gifts = current ? giftsOf(current, k) : []
  const live = gifts.filter((g) => g.live).slice(0, 3), soon = gifts.filter((g) => !g.live)
  const metal = <><i className={p.brush} aria-hidden="true" /><i className={p.band} aria-hidden="true" /><i className={p.glare} aria-hidden="true" /><i className={p.sweep} aria-hidden="true" /><i className={p.rim} aria-hidden="true" /></>
  const brand = <span className={p.brand}><img src={`/brand/a-reit/mark-${shot === 'dark' ? 'dark' : 'light'}.svg`} alt="" width={16} height={18} /><span>A-REIT</span></span>

  return <div className={p.stage}>
    <div ref={ref} className={p.plate} data-theme={shot} data-touched={touched || undefined} data-flipped={flipped || undefined} data-turning={turning || undefined}
      onPointerMove={onMove} onPointerLeave={rest} onPointerCancel={() => { press.current = null; rest() }} onPointerDown={onDown} onPointerUp={onUp}
      role="group" aria-label={t('我的邀请函', 'My invitation')}>
      <div className={p.flipper}>
        <section className={`${p.face} ${p.front}`} inert={flipped || undefined} aria-hidden={flipped || undefined}>
          {metal}
          <div className={p.content}>
            <header className={p.head}>{brand}<span className={p.kind}><i aria-hidden="true" />{t('邀请有效', 'Active')}</span></header>
            <div className={p.who}>
              <b className={p.name} dir="auto">{name}</b>
              {level && <span className={p.rank} dir="ltr">L{level}</span>}
            </div>
            <span className={p.role}>{t('邀请你加入 A-REIT', 'invites you to A-REIT')}</span>
            <footer className={p.foot}>
              <span className={p.footText}>
                <small>{t('邀请码', 'INVITATION CODE')}</small>
                <span className={p.codeRow}>
                  <button type="button" className={p.code} onClick={onCopy} aria-label={t(`邀请码 ${code.toUpperCase()}，点按复制邀请链接`, `Invitation code ${code.toUpperCase()}, tap to copy the link`)}><span dir="ltr">{displayInviteCode(code)}</span></button>
                  <button type="button" className={p.inline} aria-haspopup="dialog" onClick={onEdit}>{t('修改', 'Edit')}</button>
                </span>
                <span className={p.meta} data-done={copied || undefined}>{copied ? t('链接已复制', 'Link copied') : invited}</span>
              </span>
              <button type="button" className={p.qr} aria-label={t('放大邀请二维码', 'Enlarge invitation QR code')} aria-haspopup="dialog" onClick={onQr}>
                <RoundQr value={link} size={84} title={t('邀请链接二维码', 'Invitation QR code')} />
              </button>
            </footer>
          </div>
          <button type="button" className={p.turnKey} onClick={turn}>{t('翻到背面：我的等级与权益', 'Turn over: my level and perks')}</button>
        </section>

        <section className={`${p.face} ${p.back}`} inert={!flipped || undefined} aria-hidden={!flipped || undefined}>
          {metal}
          <div className={p.content}>
            <header className={p.head}>{brand}<span className={p.hint}><RotateCcw size={13} strokeWidth={2} aria-hidden="true" />{t('点按翻回', 'Tap to turn back')}</span></header>
            {galaxy ? <>
              <small className={p.backKicker}>{t('我的会员等级', 'My level')}</small>
              <b className={p.backRank} dir="ltr">L{galaxy.level.index}</b>
              <div className={p.backScore}>
                <span><small>{k.score}</small><b dir="ltr">{num(score)}</b></span>
                <i className={p.backBar}><i style={{ width: `${progress * 100}%` }} /></i>
                <small dir="ltr">{next ? k.toGo(`L${next.index}`, num(Math.max(0, to - score))) : k.top}</small>
              </div>
              {missing.length > 0 && <ul className={p.backList} aria-label={k.needs}>{missing.map((line) => <li key={line}>{line}</li>)}</ul>}
              <div className={p.backGifts}>
                <small>{k.gifts}</small>
                <ul>{live.map((g) => <li key={g.name}>{g.name}</li>)}</ul>
                {soon.length > 0 && <p>{k.soonPill} · {soon.map((g) => g.name).join(' · ')}</p>}
              </div>
              <button type="button" className={p.allKey} onClick={() => openPath('/profile/galaxy')}>{t('查看全部等级', 'See every level')}<ArrowRight size={14} strokeWidth={2} aria-hidden="true" /></button>
            </> : <p className={p.backEmpty}>{t('等级信息加载中…', 'Loading your level…')}</p>}
          </div>
          <button type="button" className={p.turnKey} onClick={turn}>{t('翻回正面', 'Turn back to the front')}</button>
        </section>
      </div>
    </div>
  </div>
}
