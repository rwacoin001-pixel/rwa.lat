const { describe, it, expect, jest: mock, afterEach } = require('@jest/globals')
import { NextRequest } from 'next/server'
import { mailDocument } from '../src/lib/mail-document'
import { routePermissions } from '../src/components/rbac-gate'
import { GET } from '../src/app/api/admin/[...path]/route'
import { ADMIN_SESSION_COOKIE } from '../src/lib/server/admin-session'

describe('inbox display and attachment proxy', () => {
  const original = global.fetch
  afterEach(() => { global.fetch = original })
  it('blocks every external resource until images are explicitly enabled', () => {
    expect(mailDocument('<p>Hello</p>')).toContain("default-src 'none'; img-src 'none'")
    expect(mailDocument('<p>Hello</p>', true)).toContain("default-src 'none'; img-src https:")
    expect(mailDocument('hello', true)).toContain("form-action 'none'")
    expect(mailDocument('hello')).toContain('name="referrer" content="no-referrer"')
  })
  it('gates the inbox route on mail.read', () => {
    expect(routePermissions('/inbox')).toEqual(['mail.read'])
  })
  it('preserves binary attachments and forwards safe download headers', async () => {
    const bytes = new Uint8Array([0, 255, 128, 10])
    global.fetch = mock.fn().mockResolvedValue(new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="test.bin"' } }))
    const request = new NextRequest('https://admin.example.com/api/admin/mail/attachments/id', { headers: { cookie: `${ADMIN_SESSION_COOKIE}=test-session` } })
    const response = await GET(request, { params: Promise.resolve({ path: ['mail','attachments','id'] }) })
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    expect(response.headers.get('content-disposition')).toContain('test.bin')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
  it('rejects unauthenticated downloads before contacting the admin service', async () => {
    global.fetch = mock.fn()
    const response = await GET(new NextRequest('https://admin.example.com/api/admin/mail/attachments/id'), { params: Promise.resolve({ path: ['mail','attachments','id'] }) })
    expect(response.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
