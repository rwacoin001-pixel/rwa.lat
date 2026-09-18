import {
  decodeCursor,
  encodeCursor,
  isValidHandle,
  normalizeHandle,
  sanitizeImages,
  sanitizeTopics,
} from '../../src/community/community.util'

describe('community util', () => {
  it('round-trips keyset cursors and rejects malformed input', () => {
    const at = new Date('2026-09-18T08:00:00.000Z')
    const id = '0b6f4f14-1111-4222-8333-abcdefabcdef'
    const cursor = encodeCursor(at, id)
    const decoded = decodeCursor(cursor)
    expect(decoded).not.toBeNull()
    expect(decoded?.at.getTime()).toBe(at.getTime())
    expect(decoded?.id).toBe(id)

    expect(decodeCursor('not-a-cursor')).toBeNull()
    expect(decodeCursor(Buffer.from('123_no-uuid').toString('base64url'))).toBeNull()
    expect(decodeCursor(Buffer.from('notanumber_0b6f4f14-1111-4222-8333-abcdefabcdef').toString('base64url'))).toBeNull()
  })

  it('normalizes and validates handles', () => {
    expect(normalizeHandle('  Rachel.C  ')).toBe('rachel.c')
    expect(isValidHandle('rachel.c')).toBe(true)
    expect(isValidHandle('laoliang88')).toBe(true)
    expect(isValidHandle('ab')).toBe(false)
    expect(isValidHandle('Upper')).toBe(false)
    expect(isValidHandle('-leading')).toBe(false)
    expect(isValidHandle('trailing-')).toBe(false)
  })

  it('sanitizes images to https and caps the count', () => {
    expect(sanitizeImages(['https://cdn.example.com/a.png', 'http://insecure.example.com/b.png'])).toEqual([
      'https://cdn.example.com/a.png',
    ])
    expect(sanitizeImages(['https://a.example.com/1.png', 'https://a.example.com/2.png', 'https://a.example.com/3.png', 'https://a.example.com/4.png', 'https://a.example.com/5.png'])).toHaveLength(4)
    expect(sanitizeImages(undefined)).toEqual([])
  })

  it('sanitizes topics: dedupe, lowercase, known filter, cap', () => {
    expect(sanitizeTopics(['RWA', 'rwa', ' ai-compute ', 'unknown'])).toEqual(['rwa', 'ai-compute', 'unknown'])
    expect(sanitizeTopics(['rwa', 'unknown'], new Set(['rwa']))).toEqual(['rwa'])
    expect(sanitizeTopics(['a', 'b', 'c', 'd', 'e'])).toHaveLength(4)
    expect(sanitizeTopics(undefined)).toEqual([])
  })
})
