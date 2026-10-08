'use client'

/**
 * Market list ↔ detail shared-element transition.
 * Elements opt in with `data-shared="<kind>:<id>:title|image"`; only the same real entity on both pages is paired.
 * Clones are fixed on <body>, inert and aria-hidden; no page, scroll container or dock ancestor is ever transformed.
 * Anything missing, slow (>1500ms), reduced-motion or interrupted falls back to plain navigation.
 */

const DURATION = 360
const WAIT = 1500
const EASE = 'cubic-bezier(.2,.7,.2,1)'
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

const ENTRANCE = (name: string) => name === 'ios-enter' || name === 'ios-return' || name.includes('mRise')

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

function run(snaps: Snap[], navigate: () => void, destination?: string) {
  const query = reducedQuery()
  const hidden = new Map<HTMLElement, string>()
  const clones: HTMLElement[] = []
  const animations: Animation[] = []
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
        if (!inView(to)) { target.style.visibility = hidden.get(target) ?? ''; hidden.delete(target); continue }
        const cs = getComputedStyle(target)
        const clone = snap.clone
        Object.assign(clone.style, { position: 'fixed', margin: '0', padding: '0', zIndex: '2147483000', pointerEvents: 'none', boxSizing: 'border-box', left: `${snap.rect.left}px`, top: `${snap.rect.top}px` })
        clone.setAttribute('aria-hidden', 'true')
        document.body.appendChild(clone)
        clones.push(clone)
        const from: Keyframe = { left: `${snap.rect.left}px`, top: `${snap.rect.top}px` }
        const end: Keyframe = { left: `${to.left}px`, top: `${to.top}px` }
        if (snap.image) {
          Object.assign(from, { width: `${snap.rect.width}px`, height: `${snap.rect.height}px`, borderRadius: snap.radius })
          Object.assign(end, { width: `${to.width}px`, height: `${to.height}px`, borderRadius: cs.borderRadius })
        } else {
          // Text interpolates font-size/line-height, never scale, so glyphs are re-laid out instead of stretched.
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
        animations.push(clone.animate([from, end], { duration: DURATION, easing: EASE, fill: 'both' }))
      }
      if (!animations.length) return cleanup()
      Promise.all(animations.map((animation) => animation.finished)).then(cleanup, cleanup)
    })
  }

  navigate()
  if (done) return
  if (find()) return animate()
  // Detail data can arrive late: watch only the app shell, give up after WAIT and leave the page as is.
  observer = new MutationObserver(() => { if (find()) animate() })
  observer.observe(document.querySelector('.rwa-mobile') ?? document.body, { childList: true, subtree: true })
  timeout = window.setTimeout(cleanup, WAIT)
}

function start(nodes: HTMLElement[], navigate: () => void, destination?: string) {
  cancelSharedTransition()
  if (typeof window === 'undefined' || typeof Element.prototype.animate !== 'function' || reducedQuery().matches) return navigate()
  const snaps = nodes.map(snapshot).filter((snap): snap is Snap => snap !== null)
  if (!snaps.length) return navigate()
  run(snaps, navigate, destination)
}

/**
 * List → detail: pairs the `data-shared` elements inside the clicked card.
 * `destination` (the openPath target) guards the expected navigation; any other one cancels.
 */
export function sharedOpen(scope: Element | null, navigate: () => void, destination?: string) {
  if (!scope) return navigate()
  start(Array.from(scope.querySelectorAll<HTMLElement>('[data-shared]')), navigate, destination)
}

/** Detail → list: pairs this entity's elements on the current page with the restored list. */
export function sharedBack(prefix: string, navigate: () => void, destination?: string) {
  if (typeof document === 'undefined') return navigate()
  const page = document.querySelector('.rwa-mobile [data-maison-page]') ?? document
  start(Array.from(page.querySelectorAll<HTMLElement>(`[data-shared^="${CSS.escape(prefix)}"]`)), navigate, destination)
}
