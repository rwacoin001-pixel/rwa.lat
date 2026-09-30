export interface KnowledgeRecord {
  id: string
  publishedRevision: number | null
  publishedAt: Date | string | null
  archivedAt: Date | string | null
  published: Record<string, unknown> | null
}

export interface KnowledgeSource {
  id: string
  sourceId: string
  revision: number
  title: string
  summary: string
  body: string
  locale: string
  category: string
  productIds: string[]
  publishedAt: string
}

const STOP_WORDS = new Set(['what', 'when', 'where', 'does', 'please', 'could', 'would', 'with', 'from', 'have', 'this', 'that', 'about', '什么', '怎么', '如何', '需要', '多久', '我的', '可以', '我们', '是否'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function knowledgeSearchPatterns(question: string): string[] {
  const terms = new Set<string>()
  for (const word of question.toLowerCase().match(/[\p{L}\p{N}_%\\-]+/gu) ?? []) {
    if (word.length < 2 || word.length > 80 || STOP_WORDS.has(word)) continue
    terms.add(word)
    for (const han of word.match(/\p{Script=Han}{2,80}/gu) ?? []) {
      for (let index = 0; index < han.length - 1 && terms.size < 24; index++) {
        const pair = han.slice(index, index + 2)
        if (!STOP_WORDS.has(pair)) terms.add(pair)
      }
    }
    if (terms.size >= 24) break
  }
  return [...terms].slice(0, 24).map(term => `%${term.replace(/[\\%_]/g, '\\$&')}%`)
}

/** Fail closed on visibility/dates and never truncate a policy mid-clause. */
export function selectKnowledgeSources(
  rows: readonly KnowledgeRecord[],
  context: { now: Date; locale: string; authenticated: boolean; maxCharacters?: number },
): KnowledgeSource[] {
  const result: KnowledgeSource[] = []
  let remaining = context.maxCharacters ?? 12000
  for (const row of rows) {
    const content = row.published
    if (!content || !UUID.test(row.id) || row.archivedAt !== null || !Number.isInteger(row.publishedRevision) || !row.publishedRevision || row.publishedRevision < 1) continue
    if (content.locale !== context.locale) continue
    if (content.visibility !== 'public' && !(content.visibility === 'authenticated' && context.authenticated)) continue
    if (!activeAt(content.effectiveAt, content.expiresAt, context.now)) continue
    const publishedAt = timestamp(row.publishedAt)
    if (publishedAt === null || publishedAt > context.now.getTime()) continue
    if (typeof content.title !== 'string' || !content.title.trim() || typeof content.body !== 'string' || !content.body.trim()) continue
    const summary = typeof content.summary === 'string' ? content.summary : ''
    const characters = content.title.length + summary.length + content.body.length
    if (characters > remaining) continue
    remaining -= characters
    result.push({
      id: row.id,
      sourceId: `kb:${row.id}:v${row.publishedRevision}`,
      revision: row.publishedRevision,
      title: content.title,
      summary,
      body: content.body,
      locale: content.locale,
      category: typeof content.category === 'string' ? content.category : 'general',
      productIds: Array.isArray(content.productIds) ? content.productIds.filter((id): id is string => typeof id === 'string' && UUID.test(id)) : [],
      publishedAt: new Date(publishedAt).toISOString(),
    })
    if (result.length >= 5) break
  }
  return result
}

export function activeAt(effectiveAt: unknown, expiresAt: unknown, now: Date): boolean {
  const start = effectiveAt == null ? null : timestamp(effectiveAt)
  const end = expiresAt == null ? null : timestamp(expiresAt)
  if ((effectiveAt != null && start === null) || (expiresAt != null && end === null)) return false
  return (start === null || start <= now.getTime()) && (end === null || end > now.getTime()) && (start === null || end === null || start < end)
}

function timestamp(value: unknown): number | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(milliseconds) ? milliseconds : null
}
