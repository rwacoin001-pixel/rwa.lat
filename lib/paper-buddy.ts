/**
 * The A-REIT paper buddy: the AI orb in palette A. An original implementation (no third-party code, data or art).
 * A matte paper sphere with two ink eyes. Each eye is a bean, a capsule along a gently bent spine with a lean, a
 * length and a width; a mood holds a few poses it moves between, so the face never freezes. Body moves (bounce, lift,
 * tremble, nod), a warm or alarmed tint and small ink marks carry the rest. A spin flings three paper streamers;
 * "done" throws paper chips. An unread badge sits on the rim.
 * Drawn in SVG; the loop stops while the page is hidden, and reduced motion keeps it still apart from blinking.
 */

export type BuddyMood =
  | 'sleep' | 'wake' | 'idle' | 'drift'
  | 'happy' | 'satisfied' | 'curious' | 'puzzled' | 'surprised' | 'shy' | 'down' | 'focused'
  | 'listening' | 'thinking' | 'searching' | 'replying' | 'insight' | 'done' | 'error' | 'refusing'

type Pose = { len: number; wid: number; lean: number; bend: number; dy: number; r: number; open: number }
type Mood = { poses: Pose[]; every?: number; gaze: string; body: string; mark?: string; tint?: keyof typeof TINTS; spin?: number; blink: number;
  independent?: boolean; converge?: number; spinOnEnter?: boolean; chips?: boolean; next?: [BuddyMood, number] }

const NS = 'http://www.w3.org/2000/svg'
const R = 44
let uid = 0
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const P = (len: number, wid: number, lean = 0, bend = 0, dy = 0, r = 1, open = 1): Pose => ({ len, wid, lean, bend, dy, r, open })

const TINTS = { warm: ['#f3c58a', .2], blush: ['#ef9b8a', .28], cool: ['#8fa3bf', .2], alarm: ['#d6453d', .26] } as const

const MOODS: Record<BuddyMood, Mood> = {
  sleep: { poses: [P(2.6, 9, 0, 0, 4)], gaze: 'down', body: 'breathe-slow', mark: 'zzz', blink: 0 },
  wake: { poses: [P(9, 7.5, 0, 0, 1, 1, .5), P(15, 8)], every: .9, gaze: 'center', body: 'stretch', blink: 1.1, next: ['idle', 2600] },
  idle: { poses: [P(18, 7.5), P(18, 7.5, 3, .5), P(17, 7.5, -2, -.4)], every: 4, gaze: 'glance', body: 'breathe', spin: .05, blink: 3.6 },
  drift: { poses: [P(9, 8, 4, 0, 3, 1.1), P(8, 8, -6, 1, 4, .9)], every: 3.5, gaze: 'wander', body: 'float', spin: .02, blink: 6, independent: true },
  happy: { poses: [P(24, 8.5, 14, 1.2, -4), P(22, 9, -10, -.9, -4, 1.14), P(25, 8, 8, 1.5, -5, .9), P(23, 9, 18, .8, -3)], every: 1.6, gaze: 'bob', body: 'bounce', spin: .12, blink: 3, tint: 'warm' },
  satisfied: { poses: [P(19, 8, 10, .8, -2), P(18, 8, 6, 1.1, -2)], every: 2.2, gaze: 'center', body: 'nod', blink: 4, tint: 'warm' },
  curious: { poses: [P(22, 9, -4, 0, -2, 1.28), P(21, 8.5, 6, .6, -2, .82)], every: 1.4, gaze: 'scan', body: 'tilt', blink: 3 },
  puzzled: { poses: [P(17, 7.5, -14, -.8, 0, .72), P(18, 7.5, 10, 1, 0, 1.2)], every: 2, gaze: 'side', body: 'tilt-back', mark: 'q', blink: 3.4 },
  surprised: { poses: [P(26, 11), P(27, 11.5, 0, 0, -1)], every: .7, gaze: 'center', body: 'lift', mark: 'bang', blink: 0 },
  shy: { poses: [P(13, 6.5, -18, -1, 3), P(12, 6.5, -24, -1.3, 4, .9)], every: 2.4, gaze: 'aside', body: 'shrink', mark: 'hatch', blink: 2.2, tint: 'blush' },
  down: { poses: [P(14, 7.5, -16, -1, 6), P(13, 7.5, -20, -.8, 7)], every: 3, gaze: 'down', body: 'sink', blink: 5, tint: 'cool' },
  focused: { poses: [P(12, 7, 0, 0, 0, 1, .9)], gaze: 'center', body: 'still', blink: 7, converge: 1 },
  listening: { poses: [P(22, 8.5), P(23, 8.5, 0, 0, -1)], every: 1, gaze: 'updown', body: 'pulse', blink: 3 },
  thinking: { poses: [P(18, 7.5, 8, .6, -2), P(17, 7.5, 12, .9, -3, .9)], every: 2.4, gaze: 'up', body: 'breathe', mark: 'dots', blink: 4 },
  searching: { poses: [P(13, 8.5), P(12, 8.5, 0, 0, 0, 1.1)], every: .45, gaze: 'sweep', body: 'still', blink: 0 },
  replying: { poses: [P(16, 8), P(15, 8.5, 2, .6)], every: .5, gaze: 'center', body: 'talk', blink: 3 },
  insight: { poses: [P(24, 8.5, 12, 1, -4), P(23, 8.5, -8, -.8, -4, 1.1)], every: 1.2, gaze: 'center', body: 'bounce-soft', mark: 'spark', blink: 0, spinOnEnter: true, tint: 'warm' },
  done: { poses: [P(24, 8.5, 14, 1.2, -4), P(23, 9, -9, -.9, -5, 1.12)], every: 1.1, gaze: 'center', body: 'bounce', blink: 0, spinOnEnter: true, chips: true, tint: 'warm' },
  error: { poses: [P(5, 11, -10, 0, 1), P(5, 11, 10, 0, 1)], every: .3, gaze: 'center', body: 'tremble', mark: 'bang', blink: 0, tint: 'alarm' },
  refusing: { poses: [P(10, 8, -12, -1, 5), P(10, 8, -16, -1.4, 6)], every: 2, gaze: 'aside-down', body: 'shake', blink: 4 },
}

// Three streamers: ring tilt (deg), radius, flattening, width, length (rad), lag (rad), the two face colours.
const RIBBONS = [
  { tilt: -14, rad: 60, flat: .22, wid: 7, len: 2.9, lag: 0, a: 'var(--accent,#0a8a73)', b: 'var(--accent-2,#19c7aa)' },
  { tilt: 10, rad: 64, flat: .18, wid: 5, len: 2.4, lag: .55, a: 'var(--paper-mid,#eeebe4)', b: 'var(--paper-lo,#d8d4cc)' },
  { tilt: -30, rad: 56, flat: .26, wid: 3.6, len: 2.1, lag: 1.0, a: 'var(--buddy-ink,#14181f)', b: '#4a515c' },
]

/** A bean outline: spine from top to bottom, bent sideways by `bend` at the middle, with round ends. */
function beanPath(len: number, wid: number, bend: number) {
  const n = 10, L: number[][] = [], Rt: number[][] = [], hw = wid / 2, half = Math.max(0, len / 2 - hw)
  bend = Math.sign(bend) * Math.min(Math.abs(bend), half * .35)
  for (let k = 0; k <= n; k++) {
    const t = k / n, y = -half + 2 * half * t, x = bend * (1 - (2 * t - 1) ** 2)
    const dx = bend * -4 * (2 * t - 1) / (2 * half || 1), nl = Math.hypot(1, dx), nx = 1 / nl, ny = -dx / nl
    L.push([x - nx * hw, y - ny * hw]); Rt.push([x + nx * hw, y + ny * hw])
  }
  const f = (v: number) => v.toFixed(2)
  let d = `M${f(L[0][0])} ${f(L[0][1])}`
  for (const p of L.slice(1)) d += ` L${f(p[0])} ${f(p[1])}`
  d += ` A${f(hw)} ${f(hw)} 0 0 0 ${f(Rt[n][0])} ${f(Rt[n][1])}`
  for (const p of Rt.slice(0, n).reverse()) d += ` L${f(p[0])} ${f(p[1])}`
  d += ` A${f(hw)} ${f(hw)} 0 0 0 ${f(L[0][0])} ${f(L[0][1])} Z`
  return d
}

type Params = { gx: number; gy: number; len: number; wid: number; lean: number; bend: number; dy: number; r: number; open: number; conv: number; by: number; bs: number; bt: number; tint: number }
type Chip = { el: SVGRectElement; x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number }

export class PaperBuddy {
  private id = ++uid
  private svg!: SVGSVGElement
  private shadow!: SVGEllipseElement
  private bodyG!: SVGGElement
  private ribBack!: SVGGElement
  private ribFront!: SVGGElement
  private tintEl!: SVGCircleElement
  private tintStops: SVGStopElement[] = []
  private eyes: { g: SVGGElement; path: SVGPathElement }[] = []
  private markG!: SVGGElement
  private badgeG!: SVGGElement
  private badgeText!: SVGTextElement
  private chipG!: SVGGElement
  private p: Params = { gx: 0, gy: 0, len: 18, wid: 7.5, lean: 0, bend: 0, dy: 0, r: 1, open: 1, conv: 0, by: 0, bs: 1, bt: 0, tint: 0 }
  private v = Object.fromEntries(Object.keys(this.p).map(k => [k, 0])) as Params
  private t: Params = { ...this.p }
  private m: Mood = MOODS.idle
  mood: BuddyMood = 'idle'
  unread = 0
  private yaw = 0; private ribbon = 0; private spinT = -1
  private blinkAt = 2; private blinkT = -1; private lids = 1
  private clock = 0; private moodT = 0; private gazeT = 0; private poseT = 0
  private chips: Chip[] = []
  private follow: [number, number] | null = null
  private followTimer = 0; private nextTimer = 0
  private frame = 0; private last = 0; private alive = true
  private reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  /** `still`: draw once and never animate (for old chat messages, so a long thread costs nothing per frame). */
  constructor(private host: HTMLElement, private size = 88, mood: BuddyMood = 'idle', private still = false) {
    this.build()
    this.set(mood)
    this.loop = this.loop.bind(this)
    if (still) { this.p = { ...this.t }; this.render(0); return }
    this.last = performance.now()
    this.frame = requestAnimationFrame(this.loop)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  destroy() {
    this.alive = false
    cancelAnimationFrame(this.frame)
    clearTimeout(this.nextTimer); clearTimeout(this.followTimer)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.svg.remove()
  }

  private onVisibility = () => {
    if (this.still) return
    if (document.hidden) cancelAnimationFrame(this.frame)
    else { this.last = performance.now(); this.frame = requestAnimationFrame(this.loop) }
  }

  private loop(now: number) {
    if (!this.alive) return
    const dt = Math.min(.05, (now - this.last) / 1000)
    this.last = now
    this.tick(dt)
    this.frame = requestAnimationFrame(this.loop)
  }

  private el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
    const e = document.createElementNS(NS, tag)
    for (const k in attrs) e.setAttribute(k, String(attrs[k]))
    if (parent) parent.appendChild(e)
    return e
  }

  private build() {
    const i = this.id
    const svg = this.el('svg', { viewBox: '-74 -70 148 148', width: this.size, height: this.size, class: 'paper-buddy', 'aria-hidden': 'true', focusable: 'false' })
    this.el('defs', {}, svg).innerHTML = `
      <radialGradient id="pbp${i}" cx="36%" cy="28%" r="78%"><stop offset="0" stop-color="var(--paper-hi,#fffdf8)"/><stop offset=".55" stop-color="var(--paper-mid,#eeebe4)"/><stop offset=".86" stop-color="var(--paper-lo,#d8d4cc)"/><stop offset="1" stop-color="var(--paper-rim,#c8c4bb)"/></radialGradient>
      <radialGradient id="pbt${i}" cx="50%" cy="62%" r="62%"><stop offset="0" stop-color="#fff" stop-opacity="1" class="pb-tint"/><stop offset="1" stop-color="#fff" stop-opacity="0" class="pb-tint"/></radialGradient>
      <filter id="pbg${i}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="${i}"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .3  0 0 0 0 .27  0 0 0 .13 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <radialGradient id="pbs${i}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#0b1220" stop-opacity=".26"/><stop offset="1" stop-color="#0b1220" stop-opacity="0"/></radialGradient>
      <clipPath id="pbc${i}"><circle r="${R}"/></clipPath>`
    this.shadow = this.el('ellipse', { cx: 0, cy: 58, rx: 32, ry: 5.5, fill: `url(#pbs${i})` }, svg)
    this.bodyG = this.el('g', {}, svg)
    this.ribBack = this.el('g', {}, this.bodyG)
    this.el('circle', { r: R, fill: `url(#pbp${i})` }, this.bodyG)
    this.el('circle', { r: R, fill: '#000', filter: `url(#pbg${i})` }, this.bodyG)
    this.tintEl = this.el('circle', { r: R, fill: `url(#pbt${i})`, opacity: 0 }, this.bodyG)
    this.tintStops = [...svg.querySelectorAll<SVGStopElement>('.pb-tint')]
    const face = this.el('g', { 'clip-path': `url(#pbc${i})` }, this.bodyG)
    this.eyes = [0, 1].map(() => { const g = this.el('g', {}, face); return { g, path: this.el('path', { fill: 'var(--buddy-ink,#14181f)' }, g) } })
    this.markG = this.el('g', { fill: 'none', stroke: 'var(--buddy-ink,#14181f)', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.bodyG)
    this.ribFront = this.el('g', {}, this.bodyG)
    this.badgeG = this.el('g', { transform: 'translate(31 -33)', opacity: 0 }, this.bodyG)
    this.el('circle', { r: 11.5, fill: '#d6453d', stroke: 'var(--badge-ring,#f4f5f7)', 'stroke-width': 3 }, this.badgeG)
    this.badgeText = this.el('text', { 'text-anchor': 'middle', y: 4.6, fill: '#fff', 'font-size': 13, 'font-weight': 700, 'font-family': 'inherit' }, this.badgeG)
    this.chipG = this.el('g', {}, svg)
    this.host.appendChild(svg)
    this.svg = svg
  }

  set(name: BuddyMood) {
    const m = MOODS[name] ?? MOODS.idle
    this.mood = name; this.m = m; this.moodT = 0; this.poseT = 0
    this.applyPose(m.poses[0])
    const tint = m.tint ? TINTS[m.tint] : null
    this.t.tint = tint ? tint[1] : 0
    if (tint) this.tintStops.forEach(s => s.setAttribute('stop-color', tint[0]))
    this.t.conv = m.converge ?? 0
    this.drawMark(m.mark)
    if (m.spinOnEnter) window.setTimeout(() => this.spin(), 250)
    if (m.chips && !this.reduced) window.setTimeout(() => this.burst(), 450)
    clearTimeout(this.nextTimer)
    if (m.next) this.nextTimer = window.setTimeout(() => this.set(m.next![0]), m.next[1])
  }

  badge(n: number) {
    this.unread = n
    this.badgeG.setAttribute('opacity', n > 0 ? '1' : '0')
    this.badgeText.textContent = n > 9 ? '9+' : String(n)
  }

  spin() { if (this.reduced || this.spinT >= 0) return; this.spinT = 0 }
  hop() { this.v.by -= 70 }

  lookAt(clientX: number, clientY: number) {
    const r = this.svg.getBoundingClientRect()
    const dx = clientX - (r.left + r.width / 2), dy = clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260)
    this.follow = [dx / d * 11 * k, dy / d * 7 * k]
    clearTimeout(this.followTimer); this.followTimer = window.setTimeout(() => { this.follow = null }, 1500)
  }

  private applyPose(pose: Pose) { Object.assign(this.t, { len: pose.len, wid: pose.wid, lean: pose.lean, bend: pose.bend, dy: pose.dy, r: pose.r, open: pose.open }) }

  private burst() {
    const colors = ['var(--accent,#0a8a73)', 'var(--buddy-ink,#14181f)', 'var(--paper-mid,#eeebe4)', 'var(--accent-2,#19c7aa)']
    for (let k = 0; k < 18; k++) {
      const a = rnd(-Math.PI * .92, -Math.PI * .08), sp = rnd(80, 160)
      const el = this.el('rect', { width: rnd(3, 6), height: rnd(6, 10), rx: .8, fill: colors[k % colors.length] }, this.chipG)
      this.chips.push({ el, x: 0, y: -14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rnd(0, 360), vr: rnd(-520, 520), life: 0 })
    }
  }

  private drawMark(kind?: string) {
    const g = this.markG
    g.textContent = ''
    if (!kind) return
    const ink = 'var(--buddy-ink,#14181f)'
    const html: Record<string, string> = {
      zzz: '<g class="pb-z"><path d="M30 -40 h8 l-8 9 h8" stroke-width="2.4"/><path d="M42 -54 h6 l-6 7 h6" stroke-width="2"/></g>',
      q: `<path d="M34 -48 a6 6 0 1 1 7 6 v4" stroke-width="2.4"/><circle cx="41" cy="-31" r="1.5" fill="${ink}" stroke="none"/>`,
      bang: `<path d="M40 -54 v12" stroke-width="3"/><circle cx="40" cy="-35" r="1.7" fill="${ink}" stroke="none"/>`,
      dots: `<g class="pb-dots"><circle cx="26" cy="-46" r="2.2" fill="${ink}" stroke="none"/><circle cx="35" cy="-50" r="2.6" fill="${ink}" stroke="none"/><circle cx="45" cy="-54" r="3" fill="${ink}" stroke="none"/></g>`,
      hatch: '<path d="M-31 11 l-4 6 M-26 11 l-4 6 M-21 11 l-4 6 M21 11 l-4 6 M26 11 l-4 6 M31 11 l-4 6" stroke-width="1.6" stroke="var(--accent,#0a8a73)"/>',
      spark: '<path d="M-40 -50 l2.6 6.4 l6.4 2.6 l-6.4 2.6 l-2.6 6.4 l-2.6 -6.4 l-6.4 -2.6 l6.4 -2.6 z" fill="var(--accent,#0a8a73)" stroke="none"/>',
    }
    g.innerHTML = html[kind] ?? ''
  }

  private gaze(dt: number) {
    const t = this.clock, g = this.m.gaze
    this.gazeT -= dt
    let gx = this.t.gx, gy = this.t.gy
    if (g === 'center') { gx = 0; gy = 0 }
    if (g === 'down') { gx = 0; gy = 7 }
    if (g === 'up') { gx = 6 + Math.sin(t * .9) * 4; gy = -9 }
    if (g === 'updown') { gx = 0; gy = Math.sin(t * 1.6) * 5 }
    if (g === 'sweep') { gx = Math.sin(t * 5) * 11; gy = 2 }
    if (g === 'bob') { gx = Math.sin(t * 1.3) * 3; gy = Math.sin(t * 3.4) * 3.5 }
    if (g === 'side') { gx = -9; gy = -2 }
    if (g === 'aside') { gx = 12; gy = 5 }
    if (g === 'aside-down') { gx = -10; gy = 7 }
    if (g === 'scan' && this.gazeT <= 0) { gx = rnd(-10, 10); gy = rnd(-6, 4); this.gazeT = rnd(.5, 1.1) }
    if (g === 'glance' && this.gazeT <= 0) { [gx, gy] = pick([[0, 0], [-11, 1], [11, 1], [0, 0], [-6, -5]]); this.gazeT = rnd(1.2, 2.6) }
    if (g === 'wander') { gx = Math.sin(t * .5) * 8; gy = Math.cos(t * .37) * 4 + 3 }
    if (this.follow && (g === 'glance' || g === 'center' || g === 'bob')) [gx, gy] = this.follow
    this.t.gx = gx; this.t.gy = gy
  }

  private motion() {
    const t = this.clock, mt = this.moodT, b = this.m.body
    let by = 0, bs = 1, bt = 0
    if (!this.reduced) {
      if (b === 'breathe') bs = 1 + Math.sin(t * 1.6) * .012
      if (b === 'breathe-slow') { bs = 1 + Math.sin(t * .9) * .02; by = 3 }
      if (b === 'float') by = Math.sin(t * 1.1) * 3
      if (b === 'bounce') { by = -Math.abs(Math.sin(t * 5)) * 7; bs = 1 + Math.abs(Math.cos(t * 5)) * .015 }
      if (b === 'bounce-soft') by = -Math.abs(Math.sin(t * 3)) * 4
      if (b === 'nod') by = Math.max(0, Math.sin(t * 4)) * 3
      if (b === 'pulse') bs = 1 + Math.sin(t * 3.2) * .025
      if (b === 'talk') bs = 1 + Math.max(0, Math.sin(t * 9)) * .018
      if (b === 'tremble') bt = Math.sin(t * 40) * 1.4
      if (b === 'shake' && mt < 1) bt = Math.sin(mt * 28) * 10 * (1 - mt)
      if (b === 'stretch' && mt < 1.2) bs = 1 + Math.sin(mt * 3) * .05
    }
    if (b === 'tilt') bt = 9
    if (b === 'tilt-back') bt = -8
    if (b === 'lift') { by = -8; bs = 1.03 }
    if (b === 'shrink') { bs = .96; by = 2 }
    if (b === 'sink') { by = 5; bs = .98 }
    this.t.by = by; this.t.bs = bs; this.t.bt = bt
  }

  private tick(dt: number) {
    const m = this.m
    this.clock += dt; this.moodT += dt
    if (m.spin && Math.random() < m.spin * dt) this.spin()
    if (m.poses.length > 1 && m.every) { this.poseT += dt; if (this.poseT >= m.every * rnd(.8, 1.25)) { this.poseT = 0; this.applyPose(pick(m.poses)) } }
    this.gaze(dt); this.motion()
    const keys = Object.keys(this.t) as (keyof Params)[]
    for (const k of keys) {
      const stiff = k === 'gx' || k === 'gy' ? 90 : k === 'by' || k === 'bt' || k === 'bs' ? 160 : 130
      const damp = k === 'by' ? 12 : k === 'len' || k === 'lean' ? 13 : 16
      this.v[k] += ((this.t[k] - this.p[k]) * stiff - this.v[k] * damp) * dt
      this.p[k] += this.v[k] * dt
    }
    if (m.blink) { this.blinkAt -= dt; if (this.blinkAt <= 0) { this.blinkT = 0; this.blinkAt = m.blink * rnd(.6, 1.4) } }
    if (this.blinkT >= 0) { this.blinkT += dt; const b = this.blinkT / .15; this.lids = b < 1 ? 1 - b : b < 2 ? b - 1 : 1; if (b >= 2) this.blinkT = -1 } else this.lids = 1
    if (this.spinT >= 0) {
      this.spinT += dt
      const s = clamp(this.spinT / 1.1, 0, 1), e = s < .5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2
      this.yaw = e * Math.PI * 2; this.ribbon = Math.sin(s * Math.PI)
      if (s >= 1) { this.spinT = -1; this.yaw = 0; this.ribbon = 0 }
    }
    this.render(dt)
  }

  private render(dt: number) {
    const p = this.p
    this.bodyG.setAttribute('transform', `translate(0 ${p.by.toFixed(2)}) rotate(${p.bt.toFixed(2)}) scale(${p.bs.toFixed(4)})`)
    this.shadow.setAttribute('rx', (32 * (1 + p.by / 120)).toFixed(2))
    this.shadow.setAttribute('opacity', (1 + p.by / 60).toFixed(2))
    this.tintEl.setAttribute('opacity', clamp(p.tint, 0, 1).toFixed(3))
    this.eyes.forEach((eye, k) => {
      const side = k ? 1 : -1, scale = k ? p.r : 1
      const baseX = side * (12.5 - p.conv * 3) + p.gx
      const lon = Math.asin(clamp(baseX / R, -.95, .95)) + this.yaw
      const front = Math.cos(lon), x = R * Math.sin(lon)
      const y = -4 + p.dy + p.gy + (k && this.m.independent ? Math.sin(this.clock * .8) * 3 : 0)
      const wid = p.wid * scale
      const len = Math.max(wid * .32, p.len * scale * clamp(p.open, 0, 1.2) * this.lids)
      eye.path.setAttribute('d', beanPath(len, wid, p.bend * side))
      eye.g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(p.lean * side).toFixed(1)}) scale(${Math.max(.05, front).toFixed(3)} 1)`)
      eye.g.style.opacity = front > 0 ? Math.min(1, front * 3).toFixed(2) : '0'
    })
    this.drawRibbons()
    this.chips = this.chips.filter(c => {
      c.life += dt; c.vy += 260 * dt; c.vx *= .99; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt
      c.el.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${c.rot.toFixed(0)}) scale(1 ${Math.cos(c.rot / 40).toFixed(2)})`)
      c.el.setAttribute('opacity', Math.max(0, 1 - c.life / 1.7).toFixed(2))
      if (c.life > 1.7) { c.el.remove(); return false }
      return true
    })
  }

  /** Each streamer: a two-sided paper band on a tilted ring round the sphere. Its width follows a twist (narrowing to an
   * edge and turning to its other face), a light edge runs along it, it tapers to the tail; parts in front of the
   * sphere go over it, the rest behind. Drawn as one smooth band per run of the same face and side. */
  private drawRibbons() {
    this.ribBack.textContent = ''; this.ribFront.textContent = ''
    if (this.ribbon < .01) return
    const amt = this.ribbon, N = 30
    for (const rb of RIBBONS) {
      const head = this.yaw - rb.lag * (1 - amt * .3), len = rb.len * amt
      const ct = Math.cos(rb.tilt * Math.PI / 180), st = Math.sin(rb.tilt * Math.PI / 180)
      const at = (a: number) => { const x0 = Math.sin(a) * rb.rad, z = Math.cos(a), y0 = -z * rb.rad * rb.flat + Math.sin(a * 3 + this.clock * 6) * 1.6
        return [x0 * ct - y0 * st, x0 * st + y0 * ct + 2, z] as const }
      const S: { x: number; y: number; z: number; face: boolean; w: number; o: number }[] = []
      for (let n = 0; n <= N; n++) {
        const a = head - len * n / N, [x, y, z] = at(a)
        const tw = Math.cos(a * 2.4 + this.clock * 4 + rb.lag * 3)
        S.push({ x, y, z, face: tw > 0, w: rb.wid * amt * (1 - (n / N) * .8) * (.16 + .84 * Math.abs(tw)), o: 1 - n / N * .6 })
      }
      let run = [S[0]]
      const flush = () => {
        if (run.length < 2) return
        const Lp: number[][] = [], Rp: number[][] = []
        run.forEach((q, k) => {
          const q2 = run[Math.min(k + 1, run.length - 1)], q0 = run[Math.max(k - 1, 0)]
          const dx = q2.x - q0.x, dy = q2.y - q0.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l
          Lp.push([q.x + nx * q.w / 2, q.y + ny * q.w / 2]); Rp.push([q.x - nx * q.w / 2, q.y - ny * q.w / 2])
        })
        const g = run.reduce((t, q) => t + q.z, 0) > 0 ? this.ribFront : this.ribBack
        const f = (v: number) => v.toFixed(1)
        const top = Lp.map(q => `${f(q[0])} ${f(q[1])}`).join(' L')
        this.el('path', { d: `M${top} L${Rp.reverse().map(q => `${f(q[0])} ${f(q[1])}`).join(' L')} Z`, fill: run[0].face ? rb.a : rb.b, opacity: run[0].o.toFixed(2) }, g)
        this.el('path', { d: `M${top}`, fill: 'none', stroke: '#fff', 'stroke-width': .7, 'stroke-linecap': 'round', opacity: (.5 * run[0].o).toFixed(2) }, g)
      }
      for (let n = 1; n <= N; n++) {
        const q = S[n], prev = run[run.length - 1]
        run.push(q)
        if (q.face !== prev.face || (q.z > 0) !== (prev.z > 0)) { flush(); run = [q] }
      }
      flush()
    }
  }
}
