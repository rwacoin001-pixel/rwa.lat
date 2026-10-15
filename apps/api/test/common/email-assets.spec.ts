import { MediaController } from '../../src/media/media.controller'
import type { Response } from 'express'

describe('Versioned public email images', () => {
  it('serves the packaged architectural JPEG with a stable public cache policy',async()=>{
    const res={set:jest.fn()}
    const result=new MediaController().serve('email-v2','architecture.jpg',res as unknown as Response)
    const chunks:Buffer[]=[]
    for await(const chunk of result.getStream()) chunks.push(Buffer.from(chunk))
    const bytes=Buffer.concat(chunks)
    expect(bytes.subarray(0,3).toString('hex')).toBe('ffd8ff')
    expect(bytes.length).toBeLessThan(100_000)
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({'Content-Type':'image/jpeg','Cache-Control':'public, max-age=86400, immutable'}))
  })
  it('serves the current full A-REIT PNG wordmark independently of the legacy cached assets', async () => {
    const res = { set: jest.fn() }
    const response = new MediaController().serve('email-v2', 'logo-lockup.png', res as unknown as Response)
    const chunks: Buffer[] = []
    for await (const chunk of response.getStream()) chunks.push(Buffer.from(chunk))
    expect(Buffer.concat(chunks).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'image/png' }))
  })
  it.each(['logo.png', 'identity-envelope.jpg', 'funds-wallet.jpg', 'security-key.jpg'])(
    'serves only the packaged %s with the correct image MIME type', async file => {
      const res = { set: jest.fn() }
      const response = new MediaController().serve('email-v1', file, res as unknown as Response)
      let bytes = 0
      for await (const chunk of response.getStream()) bytes += chunk.length
      expect(bytes).toBeGreaterThan(1000)
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': file.endsWith('.png') ? 'image/png' : 'image/jpeg' }))
    })
  it.each([['email-v1', '../data-contract.json'], ['email-v1', 'private.png'], ['email-v2', '../logo-lockup.png'], ['email-v2', 'private.png'], ['__proto__', 'logo.png'], ['email-templates', 'data-contract.json']])(
    'rejects private resources and unknown scope or file %s/%s', (scope, file) => {
      expect(() => new MediaController().serve(scope, file, {} as Response)).toThrow()
    })
})
