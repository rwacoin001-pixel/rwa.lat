import type { DataSourceOptions } from 'typeorm'
import { join } from 'node:path'

type PostgresDataSourceOptions = Extract<DataSourceOptions, { type: 'postgres' }>

export function buildDatabaseOptions(env: NodeJS.ProcessEnv): any {
  const url = env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL must be set; application databases are never used for destructive tests')
  const target = new URL(url)
  const database = decodeURIComponent(target.pathname.slice(1))
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !database.endsWith('_test')) {
    throw new Error('The test database name must end with _test')
  }
  for (const configured of [env.ADMIN_DATABASE_URL, env.CORE_DATABASE_URL, env.DATABASE_URL]) {
    if (!configured) continue
    const application = new URL(configured)
    if (target.hostname === application.hostname
      && (target.port || '5432') === (application.port || '5432')
      && database === decodeURIComponent(application.pathname.slice(1))) {
      throw new Error('The test database must be separate from application databases')
    }
  }
  const ssl = env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  return {
    type: 'postgres',
    url,
    ssl,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'schema_migrations',
    entities: [join(__dirname, '..', '..', '..', 'api', 'src', '**', '*.entity.ts')],
    migrations: [join(__dirname, '..', '..', '..', 'api', 'src', 'database', 'migrations', '*.ts')],
    logging: false,
  }
}
