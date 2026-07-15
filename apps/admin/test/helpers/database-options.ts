import type { DataSourceOptions } from 'typeorm'
import { join } from 'node:path'

type PostgresDataSourceOptions = Extract<DataSourceOptions, { type: 'postgres' }>

export function buildDatabaseOptions(env: NodeJS.ProcessEnv): any {
  const url = env.ADMIN_DATABASE_URL ?? env.DATABASE_URL
  if (!url) throw new Error('ADMIN_DATABASE_URL or DATABASE_URL must be set')
  const ssl = env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  return {
    type: 'postgres',
    url,
    ssl,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'schema_migrations',
    entities: [join(__dirname, '..', '..', '..', '..', 'apps', 'api', 'src', '**', '*.entity.ts')],
    migrations: [join(__dirname, '..', '..', '..', '..', 'apps', 'api', 'src', 'database', 'migrations', '*.ts')],
    logging: false,
  }
}