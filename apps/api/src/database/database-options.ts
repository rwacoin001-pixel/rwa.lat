import type { DataSourceOptions } from 'typeorm'
import { join } from 'node:path'

type DatabaseEnvironment = NodeJS.ProcessEnv & {
  APP_ENV?: string
  NODE_ENV?: string
  DATABASE_URL?: string
  TEST_DATABASE_URL?: string
  DEMO_DATABASE_URL?: string
  STAGING_DATABASE_URL?: string
  PRODUCTION_DATABASE_URL?: string
  DATABASE_POOL_MAX?: string
  DATABASE_CONNECTION_TIMEOUT_MS?: string
  DATABASE_IDLE_TIMEOUT_MS?: string
}

type PostgresDataSourceOptions = Extract<DataSourceOptions, { type: 'postgres' }>
type AppEnvironment = 'development' | 'test' | 'demo' | 'staging' | 'production'

const urlKeys: Record<AppEnvironment, keyof DatabaseEnvironment> = {
  development: 'DATABASE_URL',
  test: 'TEST_DATABASE_URL',
  demo: 'DEMO_DATABASE_URL',
  staging: 'STAGING_DATABASE_URL',
  production: 'PRODUCTION_DATABASE_URL',
}

export function buildDatabaseOptions(env: DatabaseEnvironment): PostgresDataSourceOptions {
  const appEnvironment = readAppEnvironment(env)
  const urlKey = urlKeys[appEnvironment]
  const url = env[urlKey]

  if (!url) {
    const suffix = appEnvironment === 'test' && !env.APP_ENV
      ? ' when NODE_ENV=test'
      : ` when APP_ENV=${appEnvironment}`
    throw new Error(`${String(urlKey)} is required${suffix}`)
  }

  if (appEnvironment === 'test' && env.DATABASE_URL && sameDatabaseTarget(url, env.DATABASE_URL)) {
    throw new Error('TEST_DATABASE_URL must not match DATABASE_URL')
  }

  if (appEnvironment === 'test' && env.DATABASE_URL) {
    assertDatabaseName(env.DATABASE_URL, 'DATABASE_URL', 'development')
  }
  assertDatabaseName(url, String(urlKey), appEnvironment)

  const poolMax = readPositiveInteger(env.DATABASE_POOL_MAX, 10, 'DATABASE_POOL_MAX')
  const connectionTimeoutMillis = readPositiveInteger(
    env.DATABASE_CONNECTION_TIMEOUT_MS,
    5_000,
    'DATABASE_CONNECTION_TIMEOUT_MS',
  )
  const idleTimeoutMillis = readPositiveInteger(
    env.DATABASE_IDLE_TIMEOUT_MS,
    30_000,
    'DATABASE_IDLE_TIMEOUT_MS',
  )

  return {
    type: 'postgres',
    url,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'schema_migrations',
    entities: [
      join(__dirname, '..', '**', '*.entity.{js,ts}'),
      join(__dirname, '..', '**', '*.entities.{js,ts}'),
    ],
    migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
    extra: {
      max: poolMax,
      connectionTimeoutMillis,
      idleTimeoutMillis,
    },
  }
}

function readAppEnvironment(env: DatabaseEnvironment): AppEnvironment {
  const value = env.NODE_ENV === 'test'
    ? 'test'
    : env.APP_ENV ?? (env.NODE_ENV === 'production' ? 'production' : 'development')
  if (value === 'development' || value === 'test' || value === 'demo' || value === 'staging' || value === 'production') {
    return value
  }

  throw new Error('APP_ENV must be development, test, demo, staging, or production')
}

function sameDatabaseTarget(first: string, second: string) {
  try {
    const firstUrl = new URL(first)
    const secondUrl = new URL(second)
    const target = (url: URL) => `${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname}`
    return target(firstUrl) === target(secondUrl)
  } catch {
    return first === second
  }
}

function assertDatabaseName(url: string, urlKey: string, appEnvironment: AppEnvironment) {
  let databaseUrl: URL
  try {
    databaseUrl = new URL(url)
  } catch {
    throw new Error(`${urlKey} must be a valid PostgreSQL URL`)
  }

  if (databaseUrl.protocol !== 'postgres:' && databaseUrl.protocol !== 'postgresql:') {
    throw new Error(`${urlKey} must be a PostgreSQL URL`)
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1))
  const expectedSuffix = `_${appEnvironment === 'development' ? 'dev' : appEnvironment}`
  if (!databaseName.endsWith(expectedSuffix)) {
    throw new Error(`${urlKey} database name must end with ${expectedSuffix}`)
  }
}

function readPositiveInteger(value: string | undefined, fallback: number, name: string) {
  if (value === undefined) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsed
}
