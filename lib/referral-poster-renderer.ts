
import { BRAND } from '@/lib/brand/build-brand'
import type { PosterModel } from './referral-poster'

const images = new Map<string, Promise<HTMLImageElement>>()
function image(src: string): Promise<HTMLImageElement> {
  const existing = images.get(src)
  if (existing) return existing
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => { images.delete(src); reject(new Error('Poster asset unavailable')) }
    img.src = src
  })
  images.set(src, pending)
  return pending
}
/** Reads the module grid back from a plain QR canvas (quiet zone included), via the top-left finder pattern. */
const grids = new WeakMap<HTMLCanvasElement, boolean[][]>()
export function qrGrid(qr: HTMLCanvasElement): boolean[][] {
  const known = grids.get(qr)
  if (known) return known
  const size = qr.width, data = qr.getContext('2d')!.getImageData(0, 0, size, size).data
  const dark = (x: number, y: number) => data[(Math.floor(y) * size + Math.floor(x)) * 4] < 128
  // The finder's top row is 7 dark modules; its first dark pixel on the diagonal marks the quiet zone's end.
  let start = 0
  while (start < size && !dark(start, start)) start++
  let end = start
  while (end < size && dark(end, start)) end++
  const module = (end - start) / 7, count = Math.round((size - 2 * start) / module)
  const grid = Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => dark(start + (col + .5) * module, start + (row + .5) * module)))
  grids.set(qr, grid)
  return grid
}
/** A rounded white plate with soft rounded modules and rounded finder eyes (2026-11-04, user: rounded QR). */
function drawRoundedQr(ctx: CanvasRenderingContext2D, qr: HTMLCanvasElement, x: number, y: number, size: number) {
  const grid = qrGrid(qr), n = grid.length, unit = size / (n + 6), pad = unit * 3
  ctx.save()
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(x, y, size, size, size * .12); ctx.fill()
  ctx.fillStyle = '#0B1110'
  const eye = (row: number, col: number) => (row < 7 && col < 7) || (row < 7 && col >= n - 7) || (row >= n - 7 && col < 7)
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    if (!grid[row][col] || eye(row, col)) continue
    ctx.beginPath(); ctx.roundRect(x + pad + col * unit + unit * .04, y + pad + row * unit + unit * .04, unit * .92, unit * .92, unit * .38); ctx.fill()
  }
  for (const [row, col] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const ex = x + pad + col * unit, ey = y + pad + row * unit
    ctx.beginPath(); ctx.roundRect(ex, ey, unit * 7, unit * 7, unit * 2); ctx.roundRect(ex + unit, ey + unit, unit * 5, unit * 5, unit * 1.3); ctx.fill('evenodd')
    ctx.beginPath(); ctx.roundRect(ex + unit * 2, ey + unit * 2, unit * 3, unit * 3, unit * .9); ctx.fill()
  }
  ctx.restore()
}
const FONT = 'Arial,"Noto Sans","Nirmala UI","PingFang SC","Microsoft YaHei",sans-serif'
type Rect = { x: number; y: number; width: number; height: number }
type Bounds = Rect & { name: string; size: number }

/** Copy sits over the artwork's negative space; focal geometry stays complete and unobscured. */
export async function drawReferralPoster(canvas: HTMLCanvasElement, model: PosterModel, qr: HTMLCanvasElement, thumbnailWidth?: number) {
  const [art, logo] = await Promise.all([image(model.background), image(model.logo)])
  const width = thumbnailWidth ?? model.platform.width
  canvas.width = width
  canvas.height = Math.round(width * model.platform.height / model.platform.width)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.scale(width / 1000, width / 1000)
  const W = 1000, H = model.platform.height / model.platform.width * W
  const landscape = model.platform.layout === 'landscape', story = model.platform.layout === 'story'
  const dark = model.template.dark, rtl = model.dir === 'rtl', layout = model.template.layout
  // Art-style posters take their ground colour from the artwork's own floor, so the footer and the wide-format copy
  // panel blend into the painting instead of sitting on white or black.
  const floorTone = layout ? (() => {
    const c = document.createElement('canvas'); c.width = c.height = 1
    const o = c.getContext('2d')!
    o.drawImage(art, 0, art.height * .9, art.width, art.height * .1, 0, 0, 1, 1)
    // Pushed toward black (dark floor) or white (light floor) so the footer copy always keeps its contrast.
    const dim = layout.footer === 'dark'
    return '#' + Array.from(o.getImageData(0, 0, 1, 1).data.slice(0, 3)).map(v => Math.round(dim ? v * .42 : v + (255 - v) * .62).toString(16).padStart(2, '0')).join('')
  })() : null
  const bg = floorTone ?? (dark ? '#080A09' : '#FAFAF8')
  const ink = dark ? '#F3F5F1' : '#14211D', muted = dark ? '#BAC7C0' : '#56665F', accent = dark ? '#67E4C0' : '#157C61'
  // The footer follows the artwork's floor, which on art-style posters may differ from the headline's ground.
  const footerDark = layout ? layout.footer === 'dark' : dark
  const fbg = floorTone ?? (footerDark ? '#080A09' : '#FAFAF8'), fInk = footerDark ? '#F3F5F1' : '#14211D', fMuted = layout ? footerDark ? '#C9D3CE' : '#46554F' : footerDark ? '#BAC7C0' : '#56665F'
  const m = landscape ? 34 : 56, reserve = story ? H * .09 : 0
  const footerY = H - reserve - (landscape ? 160 : 210)
  const top = story ? H * .065 : landscape ? 27 : 45
  const body: Rect = { x: m, y: top + (landscape ? 72 : 110), width: W - m * 2, height: footerY - top - (landscape ? 88 : 134) }
  const bounds: Bounds[] = [], artwork: Rect[] = [], artworkFrames: Rect[] = []
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'top'
  function font(size: number, weight: number, serif = false) { ctx!.font = `${weight} ${size}px ${serif ? 'Georgia,' : ''}${FONT}` }
  function linesFor(value: string, maxWidth: number): string[] {
    return value.split('\n').flatMap(paragraph => {
      const spaced = /\s/.test(paragraph), words = spaced ? paragraph.split(/\s+/) : Array.from(paragraph)
      const lines: string[] = []; let line = ''
      for (const word of words) {
        const next = line ? line + (spaced ? ' ' : '') + word : word
        if (ctx!.measureText(next).width <= maxWidth) { line = next; continue }
        if (line) { lines.push(line); line = '' }
        if (ctx!.measureText(word).width > maxWidth) {
          for (const char of Array.from(word)) {
            if (line && ctx!.measureText(line + char).width > maxWidth) { lines.push(line); line = '' }
            line += char
          }
        } else line = word
      }
      if (line) lines.push(line)
      return lines
    })
  }
  type Align = 'start' | 'center' | 'end'
  function text(name: string, value: string, box: Rect, preferred: number, weight = 400, color = ink, ltr = false, serif = false, alignment: Align | boolean = 'start') {
    const align = typeof alignment === 'boolean' ? alignment ? 'center' : 'start' : alignment
    let size = preferred, lines: string[] = []
    const leading = model.locale === 'hi' || model.locale === 'ar' ? 1.48 : 1.30
    for (; size >= 12; size--) {
      font(size, weight, serif); lines = linesFor(value, box.width)
      if (lines.length * size * leading <= box.height) break
    }
    if (size < 12) throw new Error(`Poster text does not fit: ${name}`)
    ctx!.fillStyle = color; ctx!.direction = ltr ? 'ltr' : model.dir
    // 'start' / 'end' follow the reading direction; LTR-only strings (code, link) keep left/right as written.
    const right = align === 'center' ? null : (align === 'end') !== (!ltr && rtl)
    ctx!.textAlign = right === null ? 'center' : right ? 'right' : 'left'
    lines.forEach((line, i) => ctx!.fillText(line, right === null ? box.x + box.width / 2 : right ? box.x + box.width : box.x, box.y + i * size * leading))
    const drawn = { ...box, name, height: lines.length * size * leading, size }
    bounds.push(drawn)
    return drawn.y + drawn.height
  }
  function media(box: Rect, subjectFrom = 0, subjectTo = 1, feathered = false) {
    // MIN, never MAX: keep the complete source visible in every platform format.
    const scale = Math.min(box.width / art.width, box.height / art.height)
    const rect = { x: box.x + (box.width - art.width * scale) / 2, y: box.y + (box.height - art.height * scale) / 2, width: art.width * scale, height: art.height * scale }
    // Extend the photographic edge tones to all four canvas edges. Only empty
    // background/floor is extended; the complete, undistorted sculpture is retained.
    // This gives every platform a full-bleed picture without cropping its subject.
    const feather = 30
    ctx!.save(); ctx!.filter = `blur(${feather}px)`
    if (rect.y > 0) ctx!.drawImage(art, 0, 0, art.width, 1, -feather, -feather, W + feather * 2, rect.y + feather * 2)
    if (rect.y + rect.height < H) ctx!.drawImage(art, 0, art.height - 1, art.width, 1, -feather, rect.y + rect.height - feather, W + feather * 2, H - rect.y - rect.height + feather * 2)
    if (rect.x > 0) ctx!.drawImage(art, 0, 0, 1, art.height, -feather, rect.y - feather, rect.x + feather * 2, rect.height + feather * 2)
    if (rect.x + rect.width < W) ctx!.drawImage(art, art.width - 1, 0, 1, art.height, rect.x + rect.width - feather, rect.y - feather, W - rect.x - rect.width + feather * 2, rect.height + feather * 2)
    ctx!.restore()
    if (feathered) {
      // Fade every edge that lies inside the poster into the extended margin, so no seam shows (art-style posters).
      const k = canvas.width / 1000, off = document.createElement('canvas')
      off.width = Math.ceil(rect.width * k); off.height = Math.ceil(rect.height * k)
      const o = off.getContext('2d')!
      o.drawImage(art, 0, 0, off.width, off.height)
      o.globalCompositeOperation = 'destination-in'
      const f = 64 * k, ow = off.width, oh = off.height
      const edges: Array<[boolean, number, number, number, number]> = [
        [rect.x > .5, 0, 0, f, 0], [rect.x + rect.width < W - .5, ow, 0, ow - f, 0],
        [rect.y > .5, 0, 0, 0, f], [rect.y + rect.height < H - .5, 0, oh, 0, oh - f],
      ]
      for (const [inside, x0, y0, x1, y1] of edges) {
        if (!inside) continue
        const g = o.createLinearGradient(x0, y0, x1, y1)
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000')
        o.fillStyle = g; o.fillRect(0, 0, ow, oh)
      }
      ctx!.drawImage(off, rect.x, rect.y, rect.width, rect.height)
    } else ctx!.drawImage(art, rect.x, rect.y, rect.width, rect.height)
    artworkFrames.push(rect)
    artwork.push({ ...rect, y: rect.y + rect.height * subjectFrom, height: rect.height * (subjectTo - subjectFrom) })
    return rect
  }
  type Palette = { ink: string; muted: string; accent: string }
  /** Chinese headline in vertical columns read right to left; punctuation dropped as in vertical calligraphy. */
  function verticalHeadline(box: Rect, color: string, serif: boolean, align: Align) {
    const columns = model.headline.split('\n').map(line => Array.from(line.replace(/[，。、！？,.!?]/g, ''))).filter(column => column.length)
    const longest = Math.max(...columns.map(column => column.length))
    let size = 84
    for (; size >= 24; size--) if (longest * size * 1.14 <= box.height && columns.length * size * 1.7 <= box.width) break
    if (size < 24) throw new Error('Poster text does not fit: headline')
    const groupW = (columns.length - 1) * size * 1.7 + size
    const left = align === 'center' ? box.x + (box.width - groupW) / 2 : (align === 'end') !== rtl ? box.x + box.width - groupW : box.x
    font(size, serif ? 400 : 700, serif); ctx!.fillStyle = color; ctx!.textAlign = 'center'; ctx!.direction = 'ltr'
    columns.forEach((column, index) => {
      const cx = left + groupW - size / 2 - index * size * 1.7
      column.forEach((char, row) => ctx!.fillText(char, cx, box.y + row * size * 1.14))
      bounds.push({ name: `headline${index}`, x: cx - size / 2, y: box.y, width: size, height: column.length * size * 1.14, size })
    })
    return box.y + longest * size * 1.14
  }
  function copy(box: Rect, large = false, serif = false, centered: Align | boolean = false, palette: Palette = { ink, muted, accent }, vertical = false) {
    let y = text('label', model.label, { ...box, height: Math.min(48, box.height * .12) }, landscape ? 17 : 22, 600, palette.accent, false, false, centered) + (landscape ? 10 : 18)
    const room = box.y + box.height - y
    if (model.rate) {
      y = text('rate', model.rate, { x: box.x, y, width: box.width, height: room * .43 }, landscape ? 116 : large ? 202 : 154, 700, ink, true) + 10
      const numericRoom = box.y + box.height - y
      y = text('description', model.description, { x: box.x, y, width: box.width, height: numericRoom * .66 }, landscape ? 21 : 28, 400) + 14
      text('levels', model.levels, { x: box.x, y, width: box.width, height: box.y + box.height - y }, landscape ? 16 : 20, 500, accent)
    } else if (model.template.kind === 'guide') {
      const rowH = room / model.steps.length
      model.steps.forEach((step, index) => {
        const row = y + index * rowH
        text(`number${index}`, String(index + 1).padStart(2, '0'), { x: box.x, y: row, width: 42, height: rowH - 8 }, landscape ? 20 : 29, 500, accent, true)
        text(`step${index}`, step, { x: box.x + 58, y: row, width: box.width - 58, height: rowH - 12 }, landscape ? 21 : 28, 500)
      })
    } else {
      const headlineBox = { x: box.x, y, width: box.width, height: room * (vertical ? .74 : .70) }
      y = (vertical ? verticalHeadline(headlineBox, palette.ink, serif, typeof centered === 'boolean' ? centered ? 'center' : 'start' : centered)
        : text('headline', model.headline, headlineBox, landscape ? 48 : large ? 92 : 72, serif ? 400 : 700, palette.ink, false, serif, centered)) + 18
      text('description', model.description, { x: box.x, y, width: box.width, height: box.y + box.height - y }, landscape ? 20 : 25, 400, palette.muted, false, false, centered)
    }
  }
  const logoW = landscape ? 162 : 205

  if (landscape) {
    const reverse = !!model.template.reverse
    const copyW = body.width * .49, artW = body.width * .45
    const copyBox = { x: reverse ? W - m - copyW : m, y: body.y, width: copyW, height: body.height }
    const artBox = { x: reverse ? m : W - m - artW, y: body.y, width: artW, height: body.height }
    media(artBox, 0, 1, !!layout)
    // Local text scrim blends into the full photo; there is no separate white panel.
    const wash = ctx.createLinearGradient(copyBox.x - 12, 0, copyBox.x + copyBox.width + 28, 0)
    wash.addColorStop(0, `${bg}FA`); wash.addColorStop(.86, `${bg}F7`); wash.addColorStop(1, `${bg}00`)
    ctx.fillStyle = wash; ctx.fillRect(copyBox.x - 12, 0, copyBox.width + 40, H)
    copy(copyBox, model.template.style === 'statement')
  } else if (layout) {
    // Movie-poster framing (2026-11-04): the artwork fills the poster edge to edge and the copy is typeset on the picture.
    // It is scaled to cover the poster unless that would crop the subject or push the headline under the logo or the
    // subject/headline into the footer; then it shrinks just enough and its feathered edges run into the extended margins.
    const aw = art.width, ah = art.height
    const logoBottom = top + logoW * logo.height / logo.width + 32, floor = footerY - 24
    const t = layout.text, sub = layout.subject
    const lowest = Math.max(sub.y + sub.h, t.y + t.h), left = Math.min(t.x, sub.x), right = Math.max(t.x + t.w, sub.x + sub.w)
    const cover = Math.max(W / aw, H / ah)
    const s = Math.min(cover, (floor - logoBottom) / ((lowest - t.y) * ah), floor / ((lowest - sub.y) * ah), W / ((right - left) * aw))
    const imgW = aw * s, imgH = ah * s
    // Prefer the artwork's own centre; then slide only as far as the constraints need.
    const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi)
    let imgX = (W - imgW) / 2, imgY = (H - reserve - imgH) / 2
    if (imgW > W) imgX = clamp(imgX, W - imgW, 0)
    if (imgH > H) imgY = clamp(imgY, H - imgH, 0)
    imgX = clamp(imgX, -left * imgW, W - right * imgW)
    imgY = clamp(imgY, Math.max(logoBottom - t.y * imgH, -sub.y * imgH), floor - lowest * imgH)
    const frame = media({ x: imgX, y: imgY, width: imgW, height: imgH }, 0, 1, true)
    const map = (b: { x: number; y: number; w: number; h: number }) => ({ x: frame.x + b.x * frame.width, y: frame.y + b.y * frame.height, width: b.w * frame.width, height: b.h * frame.height })
    artwork.pop(); artwork.push(map(sub))
    const raw = map(t)
    const x0 = Math.max(m, raw.x), x1 = Math.min(W - m, raw.x + raw.width), y0 = Math.max(logoBottom, raw.y)
    const box = { x: x0, y: y0, width: x1 - x0, height: Math.min(floor, raw.y + raw.height) - y0 }
    const onDark = layout.ink !== 'ink'
    const palette = layout.ink === 'ink' ? { ink: '#14211D', muted: '#3F4E48', accent: '#0F7F67' }
      : layout.ink === 'paper' ? { ink: '#F5F7F3', muted: '#D7E0DB', accent: '#67E4C0' }
      : { ink: '#3CE0B1', muted: '#D7E0DB', accent: '#F5F7F3' }
    if (layout.scrim !== 'none') {
      // A soft pool of shade (or light) under the copy, like a poster's title vignette; never a box.
      const alpha = layout.scrim === 'strong' ? .78 : .58
      ctx.save(); ctx.translate(box.x + box.width / 2, box.y + box.height / 2); ctx.scale(box.width * .78, box.height * .85)
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      glow.addColorStop(0, onDark ? `rgba(6,8,9,${alpha})` : `rgba(250,250,248,${alpha + .06})`); glow.addColorStop(.55, onDark ? `rgba(6,8,9,${alpha * .6})` : `rgba(250,250,248,${alpha * .6})`); glow.addColorStop(1, onDark ? 'rgba(6,8,9,0)' : 'rgba(250,250,248,0)')
      ctx.fillStyle = glow; ctx.fillRect(-1, -1, 2, 2); ctx.restore()
    }
    copy(box, true, layout.font === 'serif', layout.align, palette, layout.vertical && model.locale === 'zh-CN')
  } else {
    // Reframe empty sky/floor instead of shrinking a photograph into a card.
    // The focal sculpture remains complete; only unused margins may leave the canvas.
    const empty = model.template.empty ?? .38
    const subjectEnd = .90, minimumCopy = model.rate || model.template.kind === 'guide' ? 260 : 220
    const space = footerY - 36 - body.y - minimumCopy
    const imageH = Math.min(W * art.height / art.width, space / (subjectEnd - empty))
    const minY = body.y + minimumCopy + 18 - imageH * empty
    const maxY = footerY - 18 - imageH * subjectEnd
    const imageY = Math.max(minY, Math.min(maxY, (H - imageH) * .5))
    const frame = media({ x: 0, y: imageY, width: W, height: imageH }, empty, subjectEnd)
    const textBottom = frame.y + frame.height * empty - 18
    // A nearly opaque local wash guarantees contrast even over an image's diagonal shadow.
    // It fades out before the subject, without a card, frame or opaque text panel.
    const wash = ctx.createLinearGradient(0, textBottom - 12, 0, textBottom + 18)
    wash.addColorStop(0, `${bg}F7`); wash.addColorStop(1, `${bg}00`)
    ctx.fillStyle = `${bg}F7`; ctx.fillRect(0, 0, W, Math.max(0, textBottom - 12))
    ctx.fillStyle = wash; ctx.fillRect(0, textBottom - 12, W, 30)
    copy({ x: m, y: body.y - 8, width: body.width, height: textBottom - body.y + 8 }, true, false, !!model.template.centered)
  }

  if (layout && !landscape) {
    // The logo sits on the picture too: a faint pool of the artwork's top tone keeps it legible over busy art (e.g. Op art).
    const lh = logoW * logo.height / logo.width, darkTop = layout.top === 'dark'
    ctx.save(); ctx.translate(m + logoW / 2, top + lh / 2); ctx.scale(logoW * .75, lh * 1.6)
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    pool.addColorStop(0, darkTop ? 'rgba(6,8,9,.5)' : 'rgba(250,250,248,.6)'); pool.addColorStop(1, darkTop ? 'rgba(6,8,9,0)' : 'rgba(250,250,248,0)')
    ctx.fillStyle = pool; ctx.fillRect(-1, -1, 2, 2); ctx.restore()
  }
  ctx.drawImage(logo, m, top, logoW, logoW * logo.height / logo.width)
  // The invitation is overlaid directly on the photo's floor, without a footer card.
  if (layout && !landscape) {
    // Full-bleed posters: the picture runs under the footer and fades into the art's own floor tone, like a billing block.
    const fade = ctx.createLinearGradient(0, footerY - 150, 0, footerY + 40)
    fade.addColorStop(0, `${fbg}00`); fade.addColorStop(.6, `${fbg}B8`); fade.addColorStop(1, `${fbg}EB`)
    ctx.fillStyle = fade; ctx.fillRect(0, footerY - 150, W, 190)
    ctx.fillStyle = `${fbg}EB`; ctx.fillRect(0, footerY + 40, W, H - footerY - 40)
  } else {
    const footerWash = ctx.createLinearGradient(0, footerY - 18, 0, footerY + 35)
    footerWash.addColorStop(0, `${fbg}00`); footerWash.addColorStop(1, `${fbg}F7`)
    ctx.fillStyle = footerWash; ctx.fillRect(0, footerY - 18, W, 53)
    ctx.fillStyle = `${fbg}F7`; ctx.fillRect(0, footerY + 35, W, H - footerY - 35)
  }
  // Bigger on 9:16 (2026-11-04): those posters are only 1080 px wide and get scaled down again when forwarded in chats.
  const qrSize = landscape ? 90 : story ? 150 : 130, qrX = rtl ? m : W - m - qrSize
  const footerX = rtl ? m + qrSize + 28 : m, footerW = W - m * 2 - qrSize - 28
  drawRoundedQr(ctx, qr, qrX, footerY, qrSize)
  text('codeLabel', model.codeLabel, { x: footerX, y: footerY + 1, width: footerW, height: landscape ? 23 : 30 }, landscape ? 14 : 18, 400, fMuted)
  text('code', model.code, { x: footerX, y: footerY + (landscape ? 26 : 34), width: footerW, height: landscape ? 34 : 46 }, landscape ? 24 : 32, 650, fInk, true)
  text('link', `${new URL(BRAND.origin).hostname} · V${model.version}`, { x: footerX, y: footerY + (landscape ? 65 : 88), width: footerW, height: 26 }, landscape ? 13 : 17, 400, fMuted, true)
  text('scanLabel', model.scanLabel, { x: qrX - (landscape ? 22 : 7), y: footerY + qrSize + 5, width: qrSize + (landscape ? 44 : 14), height: landscape ? 44 : 36 }, landscape ? 12 : 13, 500, fInk, false, false, 'center')
  text('disclaimer', model.disclaimer, { x: footerX, y: footerY + (landscape ? 118 : 166), width: footerW, height: landscape ? 32 : 38 }, landscape ? 12 : 14, 400, fMuted)
  const outside = bounds.find(box => box.x < 0 || box.y < 0 || box.x + box.width > W + 1 || box.y + box.height > H - reserve + 1)
  if (outside) throw new Error(`Poster text outside safe area: ${outside.name}`)
  const obscured = bounds.find(box => artwork.some(photo => Math.min(box.x + box.width, photo.x + photo.width) - Math.max(box.x, photo.x) > 1 && Math.min(box.y + box.height, photo.y + photo.height) - Math.max(box.y, photo.y) > 1))
  if (obscured) throw new Error(`Poster text obscures artwork: ${obscured.name}`)
  return { width: canvas.width, height: canvas.height, qr: { x: qrX, y: footerY, size: qrSize }, bounds, artwork, artworkFrames, artworkFit: 'full-bleed' as const, normalizedHeight: H }
}
