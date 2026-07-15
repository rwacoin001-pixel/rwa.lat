import { buildDatabaseOptions } from '../src/database/database-options'
import { shouldApplyDemoSeed } from '../src/database/demo-seed-policy'

describe('database configuration', () => {
  it('uses the dedicated test database and a bounded connection pool', () => {
    const options = buildDatabaseOptions({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat_dev',
      TEST_DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat_test',
      DATABASE_POOL_MAX: '6',
    })

    expect(options.url).toBe('postgresql://rwa:rwa@localhost:5432/rwa_lat_test')
    expect(options.extra).toMatchObject({ max: 6 })
    expect(options.synchronize).toBe(false)
    expect(options.entities).toEqual(expect.arrayContaining([
      expect.stringContaining('*.entity.{js,ts}'),
      expect.stringContaining('*.entities.{js,ts}'),
    ]))
  })

  it('refuses to use the development database when the test URL is missing', () => {
    expect(() =>
      buildDatabaseOptions({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat_dev',
      }),
    ).toThrow('TEST_DATABASE_URL is required when NODE_ENV=test')
  })

  it('refuses a test URL that points at the development database', () => {
    expect(() =>
      buildDatabaseOptions({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat',
        TEST_DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat',
      }),
    ).toThrow('TEST_DATABASE_URL must not match DATABASE_URL')
  })

  it('requires an environment-specific URL in production', () => {
    expect(() =>
      buildDatabaseOptions({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat_dev',
      }),
    ).toThrow('PRODUCTION_DATABASE_URL is required when APP_ENV=production')
  })

  it('requires the database name to match the application environment', () => {
    expect(() =>
      buildDatabaseOptions({
        APP_ENV: 'test',
        DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat_dev',
        TEST_DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_other_dev?application_name=test',
      }),
    ).toThrow('TEST_DATABASE_URL database name must end with _test')
  })

  it('gives NODE_ENV=test priority over a development value loaded from .env', () => {
    const options = buildDatabaseOptions({
      NODE_ENV: 'test',
      APP_ENV: 'development',
      DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat_dev',
      TEST_DATABASE_URL: 'postgresql://rwa:rwa@localhost:5432/rwa_lat_test',
    })

    expect(options.url).toBe('postgresql://rwa:rwa@localhost:5432/rwa_lat_test')
  })

  it.each([
    ['demo', 'DEMO_DATABASE_URL', 'postgresql://rwa:rwa@localhost:5432/rwa_lat_demo'],
    ['staging', 'STAGING_DATABASE_URL', 'postgresql://rwa:rwa@localhost:5432/rwa_lat_staging'],
    ['production', 'PRODUCTION_DATABASE_URL', 'postgresql://rwa:rwa@localhost:5432/rwa_lat_production'],
  ] as const)('uses the dedicated %s database URL', (appEnvironment, key, url) => {
    const options = buildDatabaseOptions({ APP_ENV: appEnvironment, [key]: url })

    expect(options.url).toBe(url)
  })

  it('forbids Demo seed data in staging and production', () => {
    expect(shouldApplyDemoSeed({ APP_ENV: 'production' })).toBe(false)
    expect(shouldApplyDemoSeed({ APP_ENV: 'staging' })).toBe(false)
    expect(shouldApplyDemoSeed({ NODE_ENV: 'production' })).toBe(false)
  })

  it('allows Demo seed data only in development, test and demo environments', () => {
    expect(shouldApplyDemoSeed({ APP_ENV: 'development' })).toBe(true)
    expect(shouldApplyDemoSeed({ NODE_ENV: 'test', APP_ENV: 'production' })).toBe(true)
    expect(shouldApplyDemoSeed({ APP_ENV: 'demo' })).toBe(true)
  })
})
