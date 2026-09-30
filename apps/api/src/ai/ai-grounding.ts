import type { KnowledgeSource } from './ai-knowledge.policy'

export type KnowledgeCitation = Pick<KnowledgeSource, 'id' | 'sourceId' | 'revision' | 'title' | 'locale' | 'publishedAt'>

/** Model output is untrusted. Citations are resolved against server-selected versions. */
export function parseGroundedReply(text: string, sources: KnowledgeSource[]): { reply: string; citations: KnowledgeCitation[] } {
  if (text.length > 24000) throw new Error('AI reply exceeds the output limit')
  const cleaned = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1')
  let value: unknown
  try { value = JSON.parse(cleaned) } catch { throw new Error('AI reply must be a JSON object') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid AI reply')
  const result = value as Record<string, unknown>
  if (Object.keys(result).some(key => !['reply', 'sourceIds'].includes(key))) throw new Error('Unexpected AI reply fields')
  if (typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 12000) throw new Error('Invalid AI reply text')
  if (!Array.isArray(result.sourceIds) || result.sourceIds.length > 5 || result.sourceIds.some(id => typeof id !== 'string')) throw new Error('Invalid AI reply sources')
  const ids = result.sourceIds as string[]
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate AI reply source')
  const citations = ids.map(sourceId => {
    const source = sources.find(row => row.sourceId === sourceId)
    if (!source) throw new Error('AI reply cites an unavailable source')
    return { id: source.id, sourceId: source.sourceId, revision: source.revision, title: source.title, locale: source.locale, publishedAt: source.publishedAt }
  })
  return { reply: result.reply.trim(), citations }
}
