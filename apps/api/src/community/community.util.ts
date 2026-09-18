export const COMMUNITY_POST_BODY_MAX = 4_000
export const COMMUNITY_COMMENT_BODY_MAX = 2_000
export const COMMUNITY_IMAGES_MAX = 4
export const COMMUNITY_TOPICS_MAX = 4
export const COMMUNITY_REPORT_REASON_MAX = 280

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle)
}

/**
 * Keyset cursor for feed/comments pagination carried as a URL-safe string.
 * Format: base64url("<epoch-millis>_<uuid>").
 */
export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.getTime()}_${id}`, 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): { at: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const separator = raw.indexOf('_')
    if (separator <= 0) return null
    const millis = Number(raw.slice(0, separator))
    const id = raw.slice(separator + 1)
    if (!Number.isFinite(millis) || !/^[0-9a-f-]{36}$/i.test(id)) return null
    return { at: new Date(millis), id }
  } catch {
    return null
  }
}

export function sanitizeImages(images: string[] | undefined): string[] {
  if (!images || images.length === 0) return []
  const cleaned = images.map((url) => url.trim()).filter((url) => /^https:\/\/\S{8,500}$/.test(url))
  return cleaned.slice(0, COMMUNITY_IMAGES_MAX)
}

export function sanitizeTopics(topics: string[] | undefined, known?: Set<string>): string[] {
  if (!topics || topics.length === 0) return []
  const seen: string[] = []
  for (const topic of topics) {
    const slug = topic.trim().toLowerCase()
    if (!slug || seen.includes(slug)) continue
    if (known && !known.has(slug)) continue
    seen.push(slug)
    if (seen.length >= COMMUNITY_TOPICS_MAX) break
  }
  return seen
}
