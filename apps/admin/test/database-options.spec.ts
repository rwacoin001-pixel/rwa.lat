import { buildDatabaseOptions } from './helpers/database-options'

describe('Destructive database test isolation', () => {
  it('never falls back to an application connection', () => {
    expect(() => buildDatabaseOptions({ DATABASE_URL: 'postgres://localhost/live' })).toThrow('TEST_DATABASE_URL')
  })
  it('rejects non-test databases and shared application targets', () => {
    expect(() => buildDatabaseOptions({ TEST_DATABASE_URL: 'postgres://localhost/live' })).toThrow('_test')
    expect(() => buildDatabaseOptions({ TEST_DATABASE_URL: 'postgres://localhost/shared_test', CORE_DATABASE_URL: 'postgres://other@localhost:5432/shared_test' })).toThrow('separate')
  })
  it('accepts an explicitly isolated test database and resolves the API migrations', () => {
    const options = buildDatabaseOptions({ TEST_DATABASE_URL: 'postgres://localhost/isolated_test', DATABASE_URL: 'postgres://localhost/live' })
    expect(options.url).toBe('postgres://localhost/isolated_test')
    expect(options.migrations[0].replace(/\\/g, '/')).toContain('/apps/api/src/database/migrations/')
  })
})
