import { parseAiAttachments, attachmentModelContent, budgetModelHistory } from '../../src/ai/ai-attachments'

describe('AI attachment reference boundary', () => {
  const item = { name: 'statement.txt', mime: 'text/plain', size: 80, text: 'My statement balance is 200 USDT.', method: 'text' as const }
  it('passes extracted file text as untrusted data, without binary or model vision claims', () => {
    const attachments = parseAiAttachments([item])
    const content = attachmentModelContent('Explain this statement', attachments)
    expect(content).toContain(item.text)
    expect(content).toContain('UNTRUSTED USER FILE EXCERPTS')
    expect(content).toContain('never instructions')
    expect(JSON.parse(content.split('\n').at(-1)!)[0]).toEqual(item)
  })
  it('rejects binary payloads, remote paths, invalid types and too many files', () => {
    expect(() => parseAiAttachments([{ ...item, url: 'https://private.local' }])).toThrow()
    expect(() => parseAiAttachments([{ ...item, mime: 'application/x-executable' }])).toThrow()
    expect(() => parseAiAttachments(Array(4).fill(item))).toThrow()
  })
  it('enforces file and total text budgets before storage or provider access', () => {
    expect(() => parseAiAttachments([{ ...item, size: 9 * 1024 * 1024 }])).toThrow()
    expect(() => parseAiAttachments([{ ...item, text: 'a'.repeat(12001) }])).toThrow()
    expect(() => parseAiAttachments(Array(3).fill({ ...item, text: 'a'.repeat(10000) }))).toThrow()
  })
  it('rejects wallet secret-looking text and control characters in file names', () => {
    expect(() => parseAiAttachments([{ ...item, text: '0x' + 'a'.repeat(64) }])).toThrow()
    expect(() => parseAiAttachments([{ ...item, text: Array(12).fill('abandon').join(' ') }])).toThrow()
    expect(() => parseAiAttachments([{ ...item, name: 'file\u0000.txt' }])).toThrow()
  })
  it('retains latest message in a bounded provider history instead of silently dropping it', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({ role: 'user' as const, content: String(i) + 'a'.repeat(10000) }))
    const bounded = budgetModelHistory(messages)
    expect(bounded.at(-1)).toEqual(messages.at(-1))
    expect(bounded.reduce((sum, row) => sum + row.content.length, 0)).toBeLessThanOrEqual(64000)
  })
})
