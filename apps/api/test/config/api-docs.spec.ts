import { exposeApiDocs } from '../../src/config/api-docs'
it('never exposes API documentation in production, including an accidental enable flag', () => {
  expect(exposeApiDocs({ APP_ENV: 'production' })).toBe(false)
  expect(exposeApiDocs({ NODE_ENV: 'production' })).toBe(false)
  expect(exposeApiDocs({ APP_ENV: 'production', API_DOCS_ENABLED: 'true' })).toBe(false)
})
it('keeps local documentation available and supports opting out', () => {
  expect(exposeApiDocs({ NODE_ENV: 'development' })).toBe(true)
  expect(exposeApiDocs({ API_DOCS_ENABLED: 'false' })).toBe(false)
})
