import { knowledgeSearchPatterns, selectKnowledgeSources } from '../../src/ai/ai-knowledge.policy'

const now = new Date('2026-09-30T00:00:00Z')
const article = () => ({
  id: '9d7f53b0-48a6-4251-a3bc-171a545b3dad',
  publishedRevision: 2,
  publishedAt: now,
  archivedAt: null,
  draft: { body: 'unpublished secret' },
  published: { title: '赎回流程', summary: '实际到账后再投资', body: '赎回申请不等于到账。', category: 'redemption', locale: 'zh-CN', visibility: 'public', productIds: [], effectiveAt: null, expiresAt: null },
})

describe('Customer knowledge source boundary', () => {
  it('reads only the published snapshot and retains its real revision', () => {
    const sources = selectKnowledgeSources([article()], { now, locale: 'zh-CN', authenticated: false })
    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({ id: article().id, revision: 2, body: '赎回申请不等于到账。' })
    expect(JSON.stringify(sources)).not.toContain('unpublished secret')
  })

  it('excludes unpublished, archived, future, expired and internal sources even for a logged-in customer', () => {
    const bad = [
      { ...article(), published: null },
      { ...article(), archivedAt: now },
      { ...article(), published: { ...article().published, effectiveAt: '2026-10-01T00:00:00Z' } },
      { ...article(), published: { ...article().published, expiresAt: now.toISOString() } },
      { ...article(), published: { ...article().published, visibility: 'internal' } },
      { ...article(), published: { ...article().published, expiresAt: 'invalid-date' } },
    ]
    expect(selectKnowledgeSources(bad, { now, locale: 'zh-CN', authenticated: true })).toEqual([])
  })

  it('requires login for authenticated content and does not silently use another language', () => {
    const row = { ...article(), published: { ...article().published, visibility: 'authenticated' } }
    expect(selectKnowledgeSources([row], { now, locale: 'zh-CN', authenticated: false })).toEqual([])
    expect(selectKnowledgeSources([row], { now, locale: 'zh-CN', authenticated: true })).toHaveLength(1)
    expect(selectKnowledgeSources([row], { now, locale: 'en', authenticated: true })).toEqual([])
  })

  it('bounds source payloads without silently truncating a policy', () => {
    const row = { ...article(), published: { ...article().published, body: 'a'.repeat(8000) } }
    expect(selectKnowledgeSources([row], { now, locale: 'zh-CN', authenticated: true, maxCharacters: 2000 })).toEqual([])
  })

  it('supports Chinese query terms and escapes SQL LIKE metacharacters', () => {
    expect(knowledgeSearchPatterns('赎回到账需要多久？')).toContain('%赎回%')
    expect(knowledgeSearchPatterns('fee_100%')).toContain('%fee\\_100\\%%')
    expect(knowledgeSearchPatterns('   ')).toEqual([])
    expect(knowledgeSearchPatterns('a'.repeat(4000))).toEqual([])
  })
})
