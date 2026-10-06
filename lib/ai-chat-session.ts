import type { AiQuestion, Citation } from './api/ai-customer'
import type { AiAttachment } from './ai-attachment-policy'

export const AI_CHAT_SESSION_KEY = 'rwa-ai-current-session-v1'

export type AiChatMessage = {
  id: number
  messageId?: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  questions?: AiQuestion[]
  attachments?: AiAttachment[]
}

type StoredMessage = Omit<AiChatMessage, 'attachments'> & {
  attachments?: Array<Pick<AiAttachment, 'name' | 'method'>>
}

export type AiChatSessionSnapshot = { sessionId: string | null; messages: AiChatMessage[] }

const MAX_MESSAGES = 80
const MAX_SNAPSHOT_CHARS = 800_000
const attachmentMethods = new Set<AiAttachment['method']>(['text', 'pdf', 'docx', 'ocr', 'image'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isQuestion(value: unknown): value is AiQuestion {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.multiple !== 'boolean' || !Array.isArray(value.options)) return false
  return value.options.every(option => isRecord(option) && typeof option.id === 'string' && typeof option.label === 'string')
}

function isCitation(value: unknown): value is Citation {
  return isRecord(value) && typeof value.id === 'string' && Number.isInteger(value.revision) && typeof value.title === 'string' && typeof value.locale === 'string' && typeof value.sourceId === 'string' && (value.url === undefined || typeof value.url === 'string')
}

function storeableMessages(messages: readonly AiChatMessage[]): StoredMessage[] {
  let lastAnswer = -1
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === 'assistant') { lastAnswer = index; break }
  }
  if (lastAnswer < 1) return []
  return messages.slice(0, lastAnswer + 1).slice(-MAX_MESSAGES).map(message => ({
    id: message.id,
    ...(message.messageId ? { messageId: message.messageId } : {}),
    role: message.role,
    content: message.content,
    ...(message.citations ? { citations: message.citations } : {}),
    ...(message.questions ? { questions: message.questions } : {}),
    ...(message.attachments?.length ? { attachments: message.attachments.map(({ name, method }) => ({ name, method })) } : {}),
  }))
}

export function serializeAiChatSession(sessionId: string | null, messages: readonly AiChatMessage[]): string | null {
  let stored = storeableMessages(messages)
  while (stored.length >= 2) {
    const serialized = JSON.stringify({ version: 1, sessionId, messages: stored })
    if (serialized.length <= MAX_SNAPSHOT_CHARS) return serialized
    stored = stored.slice(2)
  }
  return null
}

export function parseAiChatSession(raw: string | null): AiChatSessionSnapshot | null {
  if (!raw || raw.length > MAX_SNAPSHOT_CHARS) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.messages) || (parsed.sessionId !== null && typeof parsed.sessionId !== 'string')) return null
    const rows = parsed.messages
    if (rows.length < 2 || rows.length > MAX_MESSAGES || rows[0]?.role !== 'user' || rows.at(-1)?.role !== 'assistant') return null
    const messages: AiChatMessage[] = []
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const expectedRole: AiChatMessage['role'] = index % 2 === 0 ? 'user' : 'assistant'
      if (!isRecord(row) || row.role !== expectedRole || !Number.isSafeInteger(row.id) || typeof row.content !== 'string' || row.content.length > MAX_SNAPSHOT_CHARS || (row.messageId !== undefined && typeof row.messageId !== 'string')) return null
      const attachments: AiAttachment[] = []
      if (row.attachments !== undefined) {
        if (!Array.isArray(row.attachments)) return null
        for (const attachment of row.attachments) {
          if (!isRecord(attachment) || typeof attachment.name !== 'string' || typeof attachment.method !== 'string' || !attachmentMethods.has(attachment.method as AiAttachment['method'])) return null
          attachments.push({ name: attachment.name, method: attachment.method as AiAttachment['method'], mime: '', size: 0, text: '' })
        }
      }
      if (row.citations !== undefined && (!Array.isArray(row.citations) || !row.citations.every(isCitation))) return null
      if (row.questions !== undefined && (!Array.isArray(row.questions) || !row.questions.every(isQuestion))) return null
      messages.push({
        id: row.id as number,
        ...(typeof row.messageId === 'string' ? { messageId: row.messageId } : {}),
        role: expectedRole,
        content: row.content,
        ...(Array.isArray(row.citations) ? { citations: row.citations } : {}),
        ...(Array.isArray(row.questions) ? { questions: row.questions } : {}),
        ...(attachments.length ? { attachments } : {}),
      })
    }
    return { sessionId: parsed.sessionId as string | null, messages }
  } catch {
    return null
  }
}

export function clearAiChatSession(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(AI_CHAT_SESSION_KEY)
}
