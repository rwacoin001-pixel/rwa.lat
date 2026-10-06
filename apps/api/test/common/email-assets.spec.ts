import { MediaController } from '../../src/media/media.controller'
import type { Response } from 'express'

describe('Versioned public email images', () => {
  it.each(['logo.png', 'identity-envelope.jpg', 'funds-wallet.jpg', 'security-key.jpg'])(
    'serves only the packaged %s with the correct image MIME type', async file => {
      const res = { set: jest.fn() }
      const response = new MediaController().serve('email-v1', file, res as unknown as Response)
      let bytes = 0
      for await (const chunk of response.getStream()) bytes += chunk.length
      expect(bytes).toBeGreaterThan(1000)
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': file.endsWith('.png') ? 'image/png' : 'image/jpeg' }))
    })
  it.each([['email-v1', '../data-contract.json'], ['email-v1', 'private.png'], ['__proto__', 'logo.png'], ['email-templates', 'data-contract.json']])(
    'rejects private resources and unknown scope or file %s/%s', (scope, file) => {
      expect(() => new MediaController().serve(scope, file, {} as Response)).toThrow()
    })
})
