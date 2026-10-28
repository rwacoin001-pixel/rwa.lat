import PostalMime from 'postal-mime'
import { signInbound } from './signature'

interface Env { INBOUND_EMAIL_SECRET: string; INBOUND_EMAIL_API_URL: string }
interface IncomingEmail { from: string; to: string; headers: Headers; raw: ReadableStream<Uint8Array>; rawSize: number }
const MAX_EMAIL = 10 * 1024 * 1024
const MAX_ATTACHMENT = 5 * 1024 * 1024
const ids = (header?: string | null) => (header?.match(/<[^<>\s]{1,990}>/g) ?? []).slice(-100)
const base64 = (buffer: ArrayBuffer | Uint8Array) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

export default {
  async email(message: IncomingEmail, env: Env): Promise<void> {
    const automated = message.headers.get('auto-submitted')
    if (automated !== null && automated.split(';')[0].trim().toLowerCase() !== 'no') return
    // Deliberate policy drops do not produce a retry loop or automatic reply.
    if (message.rawSize > MAX_EMAIL) return
    const reader = message.raw.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_EMAIL) { await reader.cancel(); return }
      chunks.push(value)
    }
    const raw = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length }
    const email = await PostalMime.parse(raw.buffer, {
      maxNestingDepth: 32, maxHeadersSize: 256 * 1024, maxPartCount: 200,
      maxRfc822NestingDepth: 3, maxForwardedAddresses: 500,
      attachmentEncoding: 'arraybuffer',
    })
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), b => b.toString(16).padStart(2, '0')).join('')
    const addresses = (values: Array<{ address?: string; group?: Array<{ address?: string }> }> = []) =>
      values.flatMap(v => v.group ?? [v]).map(v => v.address).filter((v): v is string => Boolean(v)).slice(0,100)
    const body = JSON.stringify({
      messageId: ids(email.messageId)[0] ?? `<${digest}@inbound.a-reit.com>`,
      from: email.from?.address || message.from,
      to: addresses(email.to).length ? addresses(email.to) : [message.to], cc: addresses(email.cc),
      subject: (email.subject ?? '').replace(/[\r\n]/g, ' ').slice(0,1000),
      text: (email.text ?? '').slice(0,2 * 1024 * 1024), html: (email.html ?? '').slice(0,2 * 1024 * 1024),
      inReplyTo: ids(email.inReplyTo)[0], references: ids(email.references),
      spamVerdict: message.headers.get('X-Cf-Spam')?.slice(0,100),
      attachments: email.attachments.slice(0,100).map(a => {
        const content = a.content
        if (typeof content === 'string') throw new Error('Expected binary MIME attachment')
        const dropped = content.byteLength > MAX_ATTACHMENT
        return { filename: (a.filename || 'attachment').slice(0,500), contentType: a.mimeType, size: content.byteLength, dropped, ...(dropped ? {} : { content: base64(content) }) }
      }),
    })
    const url = new URL(env.INBOUND_EMAIL_API_URL)
    if (url.protocol !== 'https:') throw new Error('Inbound API must use HTTPS')
    const response = await fetch(url, {
      method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json', 'X-Inbound-Signature': await signInbound(body, env.INBOUND_EMAIL_SECRET) },
      body, signal: AbortSignal.timeout(25000),
    })
    if (!response.ok) throw new Error(`Inbound API rejected delivery (${response.status})`)
  },
}
