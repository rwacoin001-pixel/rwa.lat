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
  const dark = model.template.dark, rtl = model.dir === 'rtl', style = model.template.style
  const bg = dark ? '#080A09' : '#FAFAF8'
  const ink = dark ? '#F3F5F1' : '#14211D', muted = dark ? '#BAC7C0' : '#56665F', accent = dark ? '#67E4C0' : '#157C61'
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
  function text(name: string, value: string, box: Rect, preferred: number, weight = 400, color = ink, ltr = false, serif = false, centered = false) {
    let size = preferred, lines: string[] = []
    const leading = model.locale === 'hi' || model.locale === 'ar' ? 1.48 : 1.30
    for (; size >= 12; size--) {
      font(size, weight, serif); lines = linesFor(value, box.width)
      if (lines.length * size * leading <= box.height) break
    }
    if (size < 12) throw new Error(`Poster text does not fit: ${name}`)
    ctx!.fillStyle = color; ctx!.direction = ltr ? 'ltr' : model.dir
    ctx!.textAlign = centered ? 'center' : !ltr && rtl ? 'right' : 'left'
    lines.forEach((line, i) => ctx!.fillText(line, centered ? box.x + box.width / 2 : !ltr && rtl ? box.x + box.width : box.x, box.y + i * size * leading))
    const drawn = { ...box, name, height: lines.length * size * leading, size }
    bounds.push(drawn)
    return drawn.y + drawn.height
  }
  function media(box: Rect, subjectFrom = 0, subjectTo = 1) {
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
    ctx!.drawImage(art, rect.x, rect.y, rect.width, rect.height)
    artworkFrames.push(rect)
    artwork.push({ ...rect, y: rect.y + rect.height * subjectFrom, height: rect.height * (subjectTo - subjectFrom) })
    return rect
  }
  function copy(box: Rect, large = false, serif = false, centered = false) {
    let y = text('label', model.label, { ...box, height: Math.min(48, box.height * .12) }, landscape ? 17 : 22, 600, accent, false, false, centered) + (landscape ? 10 : 18)
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
      y = text('headline', model.headline, { x: box.x, y, width: box.width, height: room * .70 }, landscape ? 48 : large ? 92 : 72, serif ? 400 : 700, ink, false, serif, centered) + 18
      text('description', model.description, { x: box.x, y, width: box.width, height: box.y + box.height - y }, landscape ? 20 : 25, 400, muted, false, false, centered)
    }
  }
  const logoW = landscape ? 162 : 205

  if (landscape) {
    const reverse = style === 'connection' || style === 'terrace'
    const copyW = body.width * .49, artW = body.width * .45
    const copyBox = { x: reverse ? W - m - copyW : m, y: body.y, width: copyW, height: body.height }
    const artBox = { x: reverse ? m : W - m - artW, y: body.y, width: artW, height: body.height }
    media(artBox)
    // Local text scrim blends into the full photo; there is no separate white panel.
    const wash = ctx.createLinearGradient(copyBox.x - 12, 0, copyBox.x + copyBox.width + 28, 0)
    wash.addColorStop(0, `${bg}FA`); wash.addColorStop(.86, `${bg}F7`); wash.addColorStop(1, `${bg}00`)
    ctx.fillStyle = wash; ctx.fillRect(copyBox.x - 12, 0, copyBox.width + 40, H)
    copy(copyBox, style === 'statement')
  } else {
    // Reframe empty sky/floor instead of shrinking a photograph into a card.
    // The focal sculpture remains complete; only unused margins may leave the canvas.
    // Share of each photo above the person's head (the wall or the night sky) that the copy may cover.
    const empty = { portal: .24, statement: .28, connection: .26, skyline: .28, orbit: .22, terrace: .26 }[style]
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
    copy({ x: m, y: body.y - 8, width: body.width, height: textBottom - body.y + 8 }, true, false, style === 'orbit' || style === 'skyline')
  }

  ctx.drawImage(logo, m, top, logoW, logoW * logo.height / logo.width)
  // The invitation is overlaid directly on the photo's floor, without a footer card.
  const footerWash = ctx.createLinearGradient(0, footerY - 18, 0, footerY + 35)
  footerWash.addColorStop(0, `${bg}00`); footerWash.addColorStop(1, `${bg}F7`)
  ctx.fillStyle = footerWash; ctx.fillRect(0, footerY - 18, W, 53)
  ctx.fillStyle = `${bg}F7`; ctx.fillRect(0, footerY + 35, W, H - footerY - 35)
  const qrSize = landscape ? 90 : 120, qrX = rtl ? m : W - m - qrSize
  const footerX = rtl ? m + qrSize + 28 : m, footerW = W - m * 2 - qrSize - 28
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(qrX, footerY, qrSize, qrSize)
  ctx.imageSmoothingEnabled = false; ctx.drawImage(qr, qrX, footerY, qrSize, qrSize); ctx.imageSmoothingEnabled = true
  text('codeLabel', model.codeLabel, { x: footerX, y: footerY + 1, width: footerW, height: landscape ? 23 : 30 }, landscape ? 14 : 18, 400, muted)
  text('code', model.code, { x: footerX, y: footerY + (landscape ? 26 : 34), width: footerW, height: landscape ? 34 : 46 }, landscape ? 24 : 32, 650, ink, true)
  text('link', `a-reit.com · V${model.version}`, { x: footerX, y: footerY + (landscape ? 65 : 88), width: footerW, height: 26 }, landscape ? 13 : 17, 400, muted, true)
  text('scanLabel', model.scanLabel, { x: qrX - (landscape ? 22 : 7), y: footerY + qrSize + 5, width: qrSize + (landscape ? 44 : 14), height: landscape ? 44 : 36 }, landscape ? 12 : 13, 500)
  text('disclaimer', model.disclaimer, { x: landscape ? footerX : m, y: footerY + (landscape ? 118 : 166), width: landscape ? footerW : W - m * 2, height: landscape ? 32 : 38 }, landscape ? 12 : 14, 400, muted)
  const outside = bounds.find(box => box.x < 0 || box.y < 0 || box.x + box.width > W + 1 || box.y + box.height > H - reserve + 1)
  if (outside) throw new Error(`Poster text outside safe area: ${outside.name}`)
  const obscured = bounds.find(box => artwork.some(photo => Math.min(box.x + box.width, photo.x + photo.width) - Math.max(box.x, photo.x) > 1 && Math.min(box.y + box.height, photo.y + photo.height) - Math.max(box.y, photo.y) > 1))
  if (obscured) throw new Error(`Poster text obscures artwork: ${obscured.name}`)
  return { width: canvas.width, height: canvas.height, qr: { x: qrX, y: footerY, size: qrSize }, bounds, artwork, artworkFrames, artworkFit: 'full-bleed' as const, normalizedHeight: H }
}
