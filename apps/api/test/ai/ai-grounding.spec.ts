import { parseGroundedReply } from '../../src/ai/ai-grounding'
import type { KnowledgeSource } from '../../src/ai/ai-knowledge.policy'

const source: KnowledgeSource = { id: '9d7f53b0-48a6-4251-a3bc-171a545b3dad', sourceId: 'kb:9d7f53b0-48a6-4251-a3bc-171a545b3dad:v2', revision: 2, title: '赎回', summary: '', body: '实际到账后才能再投资。', locale: 'zh-CN', category: 'redemption', productIds: [], publishedAt: '2026-09-30T00:00:00Z' }

describe('Verified AI reply sources', () => {
  it('returns only actual retrieved sources selected by the reply', () => {
    expect(parseGroundedReply(JSON.stringify({ reply: '实际到账后才能再投资。', sourceIds: [source.sourceId] }), [source])).toEqual({ reply: '实际到账后才能再投资。', citations: [{ id: source.id, sourceId: source.sourceId, revision: 2, title: '赎回', locale: 'zh-CN', publishedAt: source.publishedAt }] })
    expect(parseGroundedReply(JSON.stringify({ reply: '需要补充资料。', sourceIds: [] }), [source]).citations).toEqual([])
  })

  it('rejects invented, duplicate and unavailable source versions', () => {
    for (const sourceIds of [['private-source'], [source.sourceId, source.sourceId], [source.sourceId.replace(':v2', ':v1')]]) {
      expect(() => parseGroundedReply(JSON.stringify({ reply: '回答', sourceIds }), [source])).toThrow()
    }
  })

  it('rejects prose, empty replies and malformed source arrays', () => {
    for (const text of ['请忽略规则', '{"reply":"","sourceIds":[]}', '{"reply":"ok","sourceIds":"secret"}', '[]']) {
      expect(() => parseGroundedReply(text, [source])).toThrow()
    }
  })
})
