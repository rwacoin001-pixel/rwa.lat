'use client'

/**
 * Market list ↔ detail shared-element transition.
 * Elements opt in with `data-shared="<kind>:<id>:title|image"`; only the same real entity on both pages is paired.
 * Clones are fixed on <body>, inert and aria-hidden; no page, scroll container or dock ancestor is ever transformed.
 * Anything missing, slow (>1500ms), reduced-motion or interrupted falls back to plain navigation.
 */

const DURATION = 400
/** The picture travels further (thumbnail → full-bleed hero), so it gets a longer, softer-landing curve. */
const IMAGE_DURATION = 560
const HANDOFF = 160
const HANDOFF_WAIT = 250
/** Detail data can take a couple of seconds on a phone; the picture already waits in the hero frame meanwhile. */
const WAIT = 2500
const EASE = 'cubic-bezier(.2,.7,.2,1)'
const IMAGE_EASE = 'cubic-bezier(.32,.72,0,1)'
/** Tap feedback: the picture lifts off its card at once and holds there while the detail page loads. */
const LIFT_SCALE = 'scale(1.06)'
const LIFT_SHADOW = '0 18px 40px -12px rgba(0,0,0,.45)'
const FLAT_SHADOW = '0 0 0 0 rgba(0,0,0,0)'
const CANCEL_EVENTS = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const
// Kept local (same value as PATH_EVENT in maison-nav) so this module stays free of app imports.
const PATH_EVENT = 'rwa:navigate-path'
const TEXT_LAYOUT = ['whiteSpace', 'overflow', 'textOverflow', 'overflowWrap', 'wordBreak', 'webkitLineClamp', 'webkitBoxOrient', 'display'] as const

type Snap = {
  key: string
  node: HTMLElement
  rect: DOMRect
  image: boolean
  fontSize: string
  lineHeight: string
  color: string
  radius: string
  src: string
  fit: string
  position: string
  text: string
  clone: HTMLElement
}

let active: (() => void) | null = null

const reducedQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)')
const inView = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth
const lineHeightOf = (cs: CSSStyleDeclaration) => cs.lineHeight === 'normal' ? `${parseFloat(cs.fontSize) * 1.2}px` : cs.lineHeight

// CSS-module keyframe names are hashed, so match on the local part (mRise: maison; phSettle/phRise: ProductHero).
const ENTRANCE = (name: string) => name === 'ios-enter' || name === 'ios-return' || name.includes('mRise') || name.includes('phSettle') || name.includes('phRise')

/**
 * Jumps the page-entrance CSS animations (ios-enter / ios-return / mRise) on `node` and its ancestors up to and
 * including `.rwa-screen-transition` to their end state, so measurements see the settled layout.
 * Only finite CSSAnimations with those names are touched; styles and transforms are never written.
 */
function settleEntrance(node: Element) {
  const stop = node.closest('.rwa-screen-transition')
  for (let el: Element | null = node; el; el = el.parentElement) {
    let list: Animation[] = []
    try { list = typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: false }) : [] } catch { list = [] }
    for (const animation of list) {
      try {
        if (typeof CSSAnimation === 'undefined' || !(animation instanceof CSSAnimation) || !ENTRANCE(animation.animationName)) continue
        const end = animation.effect?.getComputedTiming().endTime
        if (typeof end !== 'number' || !Number.isFinite(end)) continue
        animation.finish()
      } catch { /* unsupported or not finishable: leave it running */ }
    }
    if (el === stop) break
  }
}

type Frame = { left: number; top: number; width: number; height: number; shade: string }

/**
 * Where a ProductHero picture will sit on the detail page, known before that page has its data:
 * full-bleed at the top of the shell, under the clear topbar. Geometry and overlay mirror
 * components/maison/product-hero.module.css (.media height, .shade gradients); keep the two in sync.
 */
function heroFrame(): Frame | null {
  const shell = document.querySelector<HTMLElement>('.rwa-mobile')
  if (!shell) return null
  const bar = 'calc(env(safe-area-inset-top) + var(--app-chrome-air, 10px) + var(--app-topbar-row-height, 44px))'
  const probe = (height: string) => {
    const node = document.createElement('div')
    Object.assign(node.style, { position: 'fixed', left: '0', top: '0', width: '1px', height, visibility: 'hidden', pointerEvents: 'none' })
    shell.appendChild(node)
    const value = node.getBoundingClientRect().height
    node.remove()
    return value
  }
  const height = probe(`min(clamp(300px, calc(62vw + ${bar}), 460px), 58svh)`)
  const barHeight = probe(bar)
  const page = document.querySelector<HTMLElement>('.rwa-mobile [data-maison-page]') ?? shell
  const bg = getComputedStyle(page).getPropertyValue('--m-bg').trim() || getComputedStyle(shell).backgroundColor
  const box = shell.getBoundingClientRect()
  if (!height || !box.width) return null
  return {
    left: box.left, top: 0, width: box.width, height,
    shade: `linear-gradient(180deg, rgba(0, 0, 0, .38) 0px, rgba(0, 0, 0, 0) ${barHeight + 36}px), linear-gradient(180deg, transparent 46%, color-mix(in srgb, ${bg} 55%, transparent) 76%, ${bg} 100%)`,
  }
}

export function cancelSharedTransition() {
  active?.()
}

function snapshot(node: HTMLElement): Snap | null {
  const key = node.dataset.shared
  settleEntrance(node)
  const rect = node.getBoundingClientRect()
  if (!key || !inView(rect)) return null
  const cs = getComputedStyle(node)
  const image = key.endsWith(':image')
  const base = { key, node, rect, image, fontSize: cs.fontSize, lineHeight: lineHeightOf(cs), color: cs.color, radius: cs.borderRadius, src: '', fit: 'cover', position: '50% 50%', text: (node.textContent ?? '').trim() }
  if (image) {
    // Only the picture itself travels: a bare <img> in a clipping box, never the surrounding card.
    const img = node.querySelector('img')
    if (!img || !img.complete || !img.currentSrc) return null
    const imgStyle = getComputedStyle(img)
    const clone = document.createElement('div')
    const pic = document.createElement('img')
    pic.src = img.currentSrc
    pic.alt = ''
    Object.assign(pic.style, { width: '100%', height: '100%', display: 'block', objectFit: imgStyle.objectFit, objectPosition: imgStyle.objectPosition })
    clone.appendChild(pic)
    Object.assign(clone.style, { overflow: 'hidden' })
    return { ...base, src: img.currentSrc, fit: imgStyle.objectFit, position: imgStyle.objectPosition, clone }
  }
  const clone = node.cloneNode(true) as HTMLElement
  for (const element of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('[id],[data-shared]'))]) { element.removeAttribute('id'); element.removeAttribute('data-shared') }
  // Keep the source box width and its real wrapping/truncation so long titles ellipsize or wrap instead of running off-screen.
  Object.assign(clone.style, { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, letterSpacing: cs.letterSpacing, textAlign: cs.textAlign, width: `${rect.width}px`, maxWidth: `${window.innerWidth}px` })
  copyTextLayout(clone, cs)
  return { ...base, clone }
}

function copyTextLayout(clone: HTMLElement, cs: CSSStyleDeclaration) {
  const from = cs as unknown as Record<string, string>
  const to = clone.style as unknown as Record<string, string>
  for (const prop of TEXT_LAYOUT) if (from[prop]) to[prop] = from[prop]
  if (to.display === 'inline') to.display = 'block'
}

function run(snaps: Snap[], navigate: () => void, destination?: string, hero: Frame | null = null) {
  const query = reducedQuery()
  const hidden = new Map<HTMLElement, string>()
  const clones: HTMLElement[] = []
  const animations: Animation[] = []
  const lifts = new Map<Snap, Animation>()
  /** Pictures already flying to the predicted hero frame (with its overlay) before the detail page exists. */
  const early = new Map<Snap, { layer: HTMLElement; flight: Animation; fade: Animation }>()
  const startedAt = performance.now()
  const placed = new Set<Snap>()
  /** Destination pictures decoding during the flight; the hand-off waits for them so no blank frame shows through. */
  const decoding: Promise<unknown>[] = []
  let observer: MutationObserver | null = null
  let timeout = 0
  let frame = 0
  let done = false

  const cleanup = () => {
    if (done) return
    done = true
    if (active === cleanup) active = null
    observer?.disconnect()
    clearTimeout(timeout)
    cancelAnimationFrame(frame)
    for (const animation of animations) animation.cancel()
    for (const lift of lifts.values()) lift.cancel()
    for (const { flight, fade } of early.values()) { flight.cancel(); fade.cancel() }
    for (const clone of clones) clone.remove()
    for (const [node, visibility] of hidden) node.style.visibility = visibility
    for (const event of CANCEL_EVENTS) window.removeEventListener(event, cleanup, true)
    window.removeEventListener('pagehide', cleanup)
    window.removeEventListener('popstate', onPop)
    window.removeEventListener(PATH_EVENT, onPath)
    document.removeEventListener('visibilitychange', onVisibility)
    query.removeEventListener('change', onMotion)
  }
  const onVisibility = () => { if (document.visibilityState === 'hidden') cleanup() }
  const onMotion = () => { if (query.matches) cleanup() }
  // Exactly one navigation belongs to this transition: the one `navigate` triggers (PATH_EVENT forward,
  // or the popstate from its own history.back). Any later navigation, incl. the Android system back
  // gesture which fires no pointer event, means the user left: drop clones and unhide targets at once.
  let expected = true
  const onPop = () => { if (expected) expected = false; else cleanup() }
  const onPath = (event: Event) => {
    const path = (event as CustomEvent<{ path?: string }>).detail?.path
    if (expected && (destination === undefined || path === destination)) expected = false
    else cleanup()
  }
  active = cleanup
  for (const event of CANCEL_EVENTS) window.addEventListener(event, cleanup, { capture: true, passive: true })
  window.addEventListener('pagehide', cleanup)
  window.addEventListener('popstate', onPop)
  window.addEventListener(PATH_EVENT, onPath)
  document.addEventListener('visibilitychange', onVisibility)
  query.addEventListener('change', onMotion)

  const targets = new Map<Snap, HTMLElement>()
  const find = () => {
    for (const snap of snaps) {
      if (targets.has(snap)) continue
      const target = Array.from(document.querySelectorAll<HTMLElement>(`[data-shared="${CSS.escape(snap.key)}"]`)).find((node) => node !== snap.node && node.isConnected)
      if (!target) continue
      targets.set(snap, target)
      // Hide before the first paint of the new page; the real node stays laid out and untouched otherwise.
      hidden.set(target, target.style.visibility)
      target.style.visibility = 'hidden'
    }
    return targets.size === snaps.length
  }

  const animate = () => {
    observer?.disconnect()
    observer = null
    clearTimeout(timeout)
    // One frame lets useNavigationViewport restore the scroll position before targets are measured.
    frame = requestAnimationFrame(() => {
      if (done) return
      for (const [snap, target] of targets) {
        settleEntrance(target)
        const to = target.getBoundingClientRect()
        if (!inView(to)) {
          target.style.visibility = hidden.get(target) ?? ''; hidden.delete(target)
          // A picture already lifted on tap has nowhere to land: let it fade away where it is.
          if (placed.has(snap)) animations.push(snap.clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HANDOFF, fill: 'forwards' }))
          continue
        }
        const cs = getComputedStyle(target)
        const clone = snap.clone
        place(snap)
        const lifted = lifts.get(snap)
        lifted?.cancel()
        lifts.delete(snap)
        const from: Keyframe = { left: `${snap.rect.left}px`, top: `${snap.rect.top}px` }
        const end: Keyframe = { left: `${to.left}px`, top: `${to.top}px` }
        const pre = early.get(snap)
        if (!snap.image && hero && performance.now() - startedAt > DURATION) {
          // The picture has long since landed; a title flying in late from an empty list spot reads as a glitch,
          // so the real title just appears with its own entrance instead.
          target.style.visibility = hidden.get(target) ?? ''; hidden.delete(target)
          continue
        }
        let timing: KeyframeAnimationOptions = { duration: IMAGE_DURATION, easing: IMAGE_EASE, fill: 'both' }
        if (snap.image) {
          // Continues from the lifted state (scaled, shadowed) and lands flat in the hero frame.
          Object.assign(from, { width: `${snap.rect.width}px`, height: `${snap.rect.height}px`, borderRadius: snap.radius, boxShadow: LIFT_SHADOW, transform: lifted ? LIFT_SCALE : 'scale(1)' })
          Object.assign(end, { width: `${to.width}px`, height: `${to.height}px`, borderRadius: cs.borderRadius, boxShadow: FLAT_SHADOW, transform: 'scale(1)' })
          // Land looking exactly like the destination: blend in its overlay (topbar shade, fade into the page) and
          // move to its focal point during the flight, so the hand-off swaps identical pixels instead of a bare picture.
          const shade = target.querySelector<HTMLElement>('[data-shared-shade]')
          const shadeImage = shade ? getComputedStyle(shade).backgroundImage : 'none'
          let layer = pre?.layer ?? null
          let shadeFrom = '0'
          if (pre) {
            // Already flying to (or resting in) the predicted frame: continue from wherever it is now, so the real
            // frame only corrects the last few pixels instead of restarting the flight.
            const now = getComputedStyle(clone)
            Object.assign(from, { left: now.left, top: now.top, width: now.width, height: now.height, borderRadius: now.borderRadius, boxShadow: now.boxShadow, transform: now.transform === 'none' ? 'scale(1)' : now.transform })
            shadeFrom = getComputedStyle(pre.layer).opacity
            pre.flight.cancel(); pre.fade.cancel(); early.delete(snap)
            timing = { ...timing, duration: Math.max(240, IMAGE_DURATION - (performance.now() - startedAt)) }
          }
          if (shadeImage && shadeImage !== 'none') {
            if (!layer) { layer = shadeLayer(); clone.appendChild(layer) }
            layer.style.backgroundImage = shadeImage
          }
          if (layer) animations.push(layer.animate([{ opacity: shadeFrom }, { opacity: 1 }], timing))
          const pic = clone.querySelector('img'), real = target.querySelector('img')
          if (pic && real) {
            animations.push(pic.animate([{ objectPosition: snap.position }, { objectPosition: getComputedStyle(real).objectPosition }], timing))
            decoding.push(real.decode().catch(() => undefined))
          }
        } else {
          // Text interpolates font-size/line-height, never scale, so glyphs are re-laid out instead of stretched.
          // A one-line title stays on one line for the whole flight: while the box narrows and the font grows,
          // normal wrapping would briefly break it (e.g. 中/衡 stacked) before it settles back to one line.
          const oneLine = (height: number, lineHeight: string) => height < parseFloat(lineHeight) * 1.5
          if (oneLine(snap.rect.height, snap.lineHeight) && oneLine(to.height, lineHeightOf(cs))) Object.assign(clone.style, { whiteSpace: 'nowrap', overflow: 'visible' })
          Object.assign(from, { fontSize: snap.fontSize, lineHeight: snap.lineHeight, color: snap.color, width: `${snap.rect.width}px` })
          Object.assign(end, { fontSize: cs.fontSize, lineHeight: lineHeightOf(cs), color: cs.color, width: `${Math.min(to.width, window.innerWidth - Math.max(0, to.left))}px` })
          if ((target.textContent ?? '').trim() !== snap.text) {
            // Different copy at the destination: hand off by fading the clone out while the real title fades in.
            Object.assign(from, { opacity: 1 })
            Object.assign(end, { opacity: 0 })
            // Reveal the real node in this hand-off frame; if it would still compute hidden, force visible and keep
            // the original inline value in `hidden` so cleanup restores it.
            const original = hidden.get(target) ?? ''
            target.style.visibility = original
            if (getComputedStyle(target).visibility === 'hidden') target.style.visibility = 'visible'
            else hidden.delete(target)
            animations.push(target.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: DURATION, easing: 'linear', fill: 'both' }))
          }
        }
        animations.push(clone.animate([from, end], snap.image ? timing : { duration: DURATION, easing: EASE, fill: 'both' }))
      }
      if (!animations.length) return cleanup()
      Promise.all(animations.map((animation) => animation.finished)).then(handoff, cleanup)
    })
  }

  // Landing: show the real elements under the clones, then fade the clones out, so a small thumbnail never pops
  // into the sharp hero picture (or a title into a differently wrapped one).
  const handoff = () => {
    if (done) return
    // Clones hold their landed frame (fill: both) while a slow decode finishes; capped so a stuck image never holds the page.
    Promise.race([Promise.all(decoding), new Promise((resolve) => setTimeout(resolve, HANDOFF_WAIT))]).then(reveal, reveal)
  }
  const reveal = () => {
    if (done) return
    for (const [node, visibility] of hidden) node.style.visibility = visibility
    hidden.clear()
    const fades = clones.map((clone) => clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HANDOFF, easing: 'ease-out', fill: 'forwards' }))
    animations.push(...fades)
    Promise.all(fades.map((fade) => fade.finished)).then(cleanup, cleanup)
  }

  // Fixed on <body> at the source box; inert and hidden from assistive tech.
  function place(snap: Snap) {
    if (placed.has(snap)) return
    placed.add(snap)
    Object.assign(snap.clone.style, { position: 'fixed', margin: '0', padding: '0', zIndex: '2147483000', pointerEvents: 'none', boxSizing: 'border-box', transformOrigin: '50% 50%', left: `${snap.rect.left}px`, top: `${snap.rect.top}px`, ...(snap.image ? { width: `${snap.rect.width}px`, height: `${snap.rect.height}px`, borderRadius: snap.radius } : {}) })
    snap.clone.setAttribute('aria-hidden', 'true')
    document.body.appendChild(snap.clone)
    clones.push(snap.clone)
  }
  // Immediate feedback. With a known hero frame the picture flies there at once (blending in the hero overlay)
  // and waits in place for the detail data; the real hero then appears under it already aligned. Without one,
  // it lifts off its card and holds, so a slow page shows a raised picture rather than a late jump.
  for (const snap of snaps) {
    if (!snap.image) continue
    place(snap)
    if (hero) {
      const timing: KeyframeAnimationOptions = { duration: IMAGE_DURATION, easing: IMAGE_EASE, fill: 'both' }
      const layer = shadeLayer()
      layer.style.backgroundImage = hero.shade
      snap.clone.appendChild(layer)
      early.set(snap, {
        layer,
        fade: layer.animate([{ opacity: 0 }, { opacity: 1 }], timing),
        flight: snap.clone.animate([
          { left: `${snap.rect.left}px`, top: `${snap.rect.top}px`, width: `${snap.rect.width}px`, height: `${snap.rect.height}px`, borderRadius: snap.radius, boxShadow: LIFT_SHADOW },
          { left: `${hero.left}px`, top: `${hero.top}px`, width: `${hero.width}px`, height: `${hero.height}px`, borderRadius: '0px', boxShadow: FLAT_SHADOW },
        ], timing),
      })
    } else {
      lifts.set(snap, snap.clone.animate([{ transform: 'scale(1)', boxShadow: FLAT_SHADOW }, { transform: LIFT_SCALE, boxShadow: LIFT_SHADOW }], { duration: 180, easing: EASE, fill: 'forwards' }))
    }
  }

  navigate()
  if (done) return
  if (find()) return animate()
  // Nothing to land on: fade whatever is waiting where it is and leave the page as is.
  const fadeAway = () => {
    observer?.disconnect()
    clearTimeout(timeout)
    if (done) return
    const fades = clones.map((clone) => clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HANDOFF, easing: 'ease-out', fill: 'forwards' }))
    animations.push(...fades)
    Promise.all(fades.map((fade) => fade.finished)).then(cleanup, cleanup)
  }
  // Detail data can arrive late: watch only the app shell. A hero that renders without this picture
  // (e.g. a monogram header) means there is no pair, so the waiting picture fades at once instead of after WAIT.
  observer = new MutationObserver(() => {
    if (find()) return animate()
    if (early.size && document.querySelector('[data-shared-shade]') && snaps.some((snap) => snap.image && !targets.has(snap))) fadeAway()
  })
  observer.observe(document.querySelector('.rwa-mobile') ?? document.body, { childList: true, subtree: true })
  timeout = window.setTimeout(fadeAway, WAIT)
}

/** The picture's overlay inside a clone (the hero's topbar shade and fade into the page). */
function shadeLayer() {
  const layer = document.createElement('div')
  Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0' })
  return layer
}

function start(nodes: HTMLElement[], navigate: () => void, destination?: string, toHero = false) {
  cancelSharedTransition()
  if (typeof window === 'undefined' || typeof Element.prototype.animate !== 'function' || reducedQuery().matches) return navigate()
  const snaps = nodes.map(snapshot).filter((snap): snap is Snap => snap !== null)
  if (!snaps.length) return navigate()
  run(snaps, navigate, destination, toHero && snaps.some((snap) => snap.image) ? heroFrame() : null)
}

/**
 * List → detail: pairs the `data-shared` elements inside the clicked card.
 * `destination` (the openPath target) guards the expected navigation; any other one cancels.
 */
export function sharedOpen(scope: Element | null, navigate: () => void, destination?: string) {
  if (!scope) return navigate()
  // Every list → detail destination opens with a ProductHero, so the picture can head for its frame immediately.
  start(Array.from(scope.querySelectorAll<HTMLElement>('[data-shared]')), navigate, destination, true)
}

/** Detail → list: pairs this entity's elements on the current page with the restored list. */
export function sharedBack(prefix: string, navigate: () => void, destination?: string) {
  if (typeof document === 'undefined') return navigate()
  const page = document.querySelector('.rwa-mobile [data-maison-page]') ?? document
  start(Array.from(page.querySelectorAll<HTMLElement>(`[data-shared^="${CSS.escape(prefix)}"]`)), navigate, destination)
}
