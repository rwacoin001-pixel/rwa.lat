import { createApiCorsOptions } from '../src/common/cors-options'

describe('API CORS options', () => {
  it('exposes rate-limit and request tracing headers to browser clients', () => {
    expect(createApiCorsOptions(['https://h5.example'])).toEqual({
      origin: ['https://h5.example'],
      credentials: true,
      exposedHeaders: ['Retry-After', 'x-request-id'],
    })
  })
})
