const TAGS = new Set(['p','br','div','span','b','strong','i','em','u','s','blockquote','pre','code','ul','ol','li','table','thead','tbody','tr','td','th','hr','h1','h2','h3'])
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Reconstruct a deliberately small HTML vocabulary. No input attribute is copied verbatim.
 * Unknown markup is escaped, so malformed/nested markup cannot escape the vocabulary.
 * Images retain only an absolute HTTPS src; iframe CSP blocks them until the reader opts in.
 */
export function sanitizeMailHtml(html: string): string {
  return html.split(/(<[^>]*>)/g).map(token => {
    const tag = /^<(\/?)\s*([a-z0-9]+)(?:\s[^<>]*)?\s*\/?\s*>$/i.exec(token)
    // Preserve text entities without interpreting them as markup in the browser tokenizer.
    if (!tag) return token.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const name = tag[2].toLowerCase()
    if (TAGS.has(name)) return `<${tag[1]}${name}>`
    if (name === 'img' && !tag[1]) {
      const src = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(token)
      try {
        const url = new URL(src?.[1] ?? src?.[2] ?? '')
        if (url.protocol === 'https:' && !url.username && !url.password) return `<img src="${escape(url.href)}" alt="" referrerpolicy="no-referrer">`
      } catch { /* Unknown or relative images are omitted. */ }
      return ''
    }
    return escape(token)
  }).join('')
}

export function normalizedSubject(subject: string): string {
  return subject.replace(/^(?:(?:re|fw|fwd|回复|转发)\s*[:：]\s*)+/i, '').trim().toLowerCase()
}
