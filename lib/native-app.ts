/**
 * Native features of the A-REIT Android app that its WebView lacks: the system share sheet and saving an image to
 * the photo gallery. The app declares what it supports in window.__rwaNativeCaps (set at document start, only on
 * a-reit.com) and answers on the RwaNativeAppChannel message bridge. Browsers and older app versions report
 * nothing, so callers keep their web behaviour.
 */
export type NativeCap = 'share' | 'save-image'
type Channel = {
  postMessage: (message: string) => void
  addEventListener?: (type: 'message', listener: (event: { data: unknown }) => void) => void
  removeEventListener?: (type: 'message', listener: (event: { data: unknown }) => void) => void
}
type NativeWindow = Window & { RwaNativeAppChannel?: Channel; __rwaNativeCaps?: unknown }

export type NativeResult = { ok: true } | { ok: false; reason: 'cancelled' | 'failed' | 'unsupported' }

const IMAGE_LIMIT = 12 * 1024 * 1024
let sequence = 0

function channel(): Channel | null {
  if (typeof window === 'undefined') return null
  const ch = (window as NativeWindow).RwaNativeAppChannel
  return ch && typeof ch.postMessage === 'function' && typeof ch.addEventListener === 'function' ? ch : null
}

export function nativeCan(cap: NativeCap): boolean {
  if (!channel()) return false
  const caps = (window as NativeWindow).__rwaNativeCaps
  return Array.isArray(caps) && caps.includes(cap)
}

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { const text = String(reader.result ?? ''); resolve(text.slice(text.indexOf(',') + 1)) }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function send(payload: Record<string, unknown>, timeoutMs = 120_000): Promise<NativeResult> {
  const ch = channel()
  if (!ch) return Promise.resolve({ ok: false, reason: 'unsupported' })
  const id = `n${Date.now().toString(36)}${(++sequence).toString(36)}`
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const listener = (event: { data: unknown }) => {
      let reply: { id?: unknown; ok?: unknown; reason?: unknown }
      try { reply = JSON.parse(String(event.data)) } catch { return }
      if (reply?.id !== id) return
      finish(reply.ok === true ? { ok: true } : { ok: false, reason: reply.reason === 'cancelled' ? 'cancelled' : 'failed' })
    }
    const finish = (result: NativeResult) => { if (timer) clearTimeout(timer); ch.removeEventListener?.('message', listener); resolve(result) }
    ch.addEventListener!('message', listener)
    timer = setTimeout(() => finish({ ok: false, reason: 'failed' }), timeoutMs)
    try { ch.postMessage(JSON.stringify({ ...payload, id })) } catch { finish({ ok: false, reason: 'failed' }) }
  })
}

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'a-reit.png'

/** Saves a PNG/JPEG to the gallery (Pictures/A-REIT). */
export async function nativeSaveImage(image: Blob, name: string): Promise<NativeResult> {
  if (!nativeCan('save-image') || image.size > IMAGE_LIMIT) return { ok: false, reason: 'unsupported' }
  return send({ type: 'save-image', name: safeName(name), mime: image.type, image: await blobBase64(image) })
}

/** Opens the system share sheet with text/link and, optionally, one image. */
export async function nativeShare(content: { title?: string; text?: string; url?: string; image?: Blob; name?: string }): Promise<NativeResult> {
  if (!nativeCan('share') || (content.image && content.image.size > IMAGE_LIMIT)) return { ok: false, reason: 'unsupported' }
  const text = [content.text, content.url].filter(Boolean).join('\n').slice(0, 2000)
  return send({
    type: 'share', title: (content.title ?? '').slice(0, 120), text,
    ...(content.image ? { name: safeName(content.name ?? 'a-reit.png'), mime: content.image.type, image: await blobBase64(content.image) } : {}),
  })
}
