import type { KnowledgeSource } from './ai-knowledge.policy'

export type KnowledgeCitation = Pick<KnowledgeSource, 'id' | 'sourceId' | 'revision' | 'title' | 'locale' | 'publishedAt'>
export type AiQuestion = { id: string; title: string; multiple: boolean; options: Array<{ id: string; label: string; description?: string }> }

/** Cards collect conversation context only; they cannot encode links, tools or financial actions. */
export function parseQuestions(value: unknown): AiQuestion[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 3) throw new Error('Invalid clarification questions')
  const ids = new Set<string>()
  const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max
  return value.map(q => {
    if (!q || typeof q !== 'object' || Array.isArray(q) || Object.keys(q).some(k => !['id', 'title', 'multiple', 'options'].includes(k))) throw new Error('Invalid question')
    if (!text(q.id, 48) || !/^[a-zA-Z0-9_-]+$/.test(q.id) || ids.has(q.id) || !text(q.title, 180) || typeof q.multiple !== 'boolean') throw new Error('Invalid question fields')
    ids.add(q.id)
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) throw new Error('Invalid question options')
    const optionIds = new Set<string>()
    const options = q.options.map((o: unknown) => {
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('Invalid option')
      const row = o as Record<string, unknown>
      if (Object.keys(row).some(k => !['id', 'label', 'description'].includes(k)) || !text(row.id, 48) || !/^[a-zA-Z0-9_-]+$/.test(row.id) || optionIds.has(row.id) || !text(row.label, 100) || (row.description !== undefined && !text(row.description, 220))) throw new Error('Invalid option fields')
      optionIds.add(row.id)
      return { id: row.id, label: row.label.trim(), ...(typeof row.description === 'string' ? { description: row.description.trim() } : {}) }
    })
    return { id: q.id, title: q.title.trim(), multiple: q.multiple, options }
  })
}

export const QUESTION_OUTPUT_CONTRACT = '\nOUTPUT CONTRACT: Return only JSON {"reply":"brief customer answer","sourceIds":[],"questions":[]}. Hard limit: at most three question objects per response. If more information is needed, ask remaining questions in a later turn. When clarification is genuinely needed, include 1–3 short questions in the user language, each {"id":"stable_key","title":"question","multiple":false,"options":[{"id":"option_key","label":"short option","description":"optional short explanation"}]}. Use 2–5 distinct options per question. The UI always provides a free-text answer; do not add Other options. Do not repeat questions already answered. Questions collect context, never consent to investment, account access or money movement. Do not preselect financial choices or invent product facts in options. For complete requests, answer directly with questions:[]. Cite only supplied sourceIds; without a source do not assert platform terms or product facts. General explanations, identity and verified account snapshots may use sourceIds:[]. Never expose internal runtime fields.'

/** Model output is untrusted. Citations are resolved against server-selected versions. */
export function parseGroundedReply(text: string, sources: KnowledgeSource[]): { reply: string; citations: KnowledgeCitation[]; questions?: AiQuestion[] } {
  if (text.length > 24000) throw new Error('AI reply exceeds the output limit')
  const cleaned = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1')
  let value: unknown
  try { value = JSON.parse(cleaned) } catch { throw new Error('AI reply must be a JSON object') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid AI reply')
  const result = value as Record<string, unknown>
  if (Object.keys(result).some(key => !['reply', 'sourceIds', 'questions'].includes(key))) throw new Error('Unexpected AI reply fields')
  if (typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 12000) throw new Error('Invalid AI reply text')
  if (!Array.isArray(result.sourceIds) || result.sourceIds.length > 5 || result.sourceIds.some(id => typeof id !== 'string')) throw new Error('Invalid AI reply sources')
  const ids = result.sourceIds as string[]
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate AI reply source')
  const citations = ids.map(sourceId => {
    const source = sources.find(row => row.sourceId === sourceId)
    if (!source) throw new Error('AI reply cites an unavailable source')
    return { id: source.id, sourceId: source.sourceId, revision: source.revision, title: source.title, locale: source.locale, publishedAt: source.publishedAt }
  })
  const questions = parseQuestions(result.questions)
  return { reply: result.reply.trim(), citations, ...(questions.length ? { questions } : {}) }
}

