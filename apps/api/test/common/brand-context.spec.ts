import { createBrandContextMiddleware, currentBrand } from '../../src/common/brand-context'
import type { Request, Response } from 'express'

describe('verified request brand context', () => {
  it('isolates overlapping Kimeng and A-REIT asynchronous requests', async () => {
    const middleware = createBrandContextMiddleware()
    const run = (brand?: 'kimeng') => new Promise<string | undefined>((resolve) => {
      const response = { locals: brand ? { edgeClient: { brand } } : {} } as unknown as Response
      middleware({} as Request, response, () => {
        setTimeout(() => resolve(currentBrand()), brand ? 5 : 1)
      })
    })
    expect(await Promise.all([run('kimeng'), run(), run('kimeng')])).toEqual(['kimeng', undefined, 'kimeng'])
    expect(currentBrand()).toBeUndefined()
  })
})
