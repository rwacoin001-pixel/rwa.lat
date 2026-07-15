import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Migration rehearsal requires NODE_ENV=test.')
}
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Migration rehearsal requires TEST_DATABASE_URL.')
}
const databaseName = new URL(process.env.TEST_DATABASE_URL).pathname.slice(1)
if (!databaseName.endsWith('_test')) {
  throw new Error('Migration rehearsal refuses to run unless the database name ends with _test.')
}

const migrationDir = resolve('src/database/migrations')
const latestFile = readdirSync(migrationDir).filter((file) => file.endsWith('.ts')).sort().at(-1)
if (!latestFile) throw new Error('No migration found for rehearsal.')
const latestSource = readFileSync(resolve(migrationDir, latestFile), 'utf8')
const latestClass = /export class (\w+)/.exec(latestSource)?.[1]
if (!latestClass) throw new Error(`Cannot find migration class in ${latestFile}.`)

const cli = resolve('node_modules/typeorm/cli-ts-node-commonjs.js')
const env = { ...process.env, NODE_ENV: 'test', APP_ENV: 'test', NODE_OPTIONS: '--max-old-space-size=768' }

function typeorm(command) {
  const result = spawnSync(
    process.execPath,
    ['--max-old-space-size=768', cli, command, '-d', 'src/database/data-source.ts'],
    { cwd: process.cwd(), env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  )
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`
}

typeorm('migration:run')
const applied = typeorm('migration:show')
if (!applied.includes(latestClass) || !applied.includes('[X]')) {
  throw new Error(`Latest migration was not applied: ${latestClass}`)
}

typeorm('migration:revert')
const reverted = typeorm('migration:show')
const latestLineAfterRevert = reverted.split(/\r?\n/).find((line) => line.includes(latestClass)) ?? ''
if (!latestLineAfterRevert.includes('[ ]')) {
  throw new Error(`Latest migration did not become pending after rollback: ${latestClass}`)
}

typeorm('migration:run')
const reapplied = typeorm('migration:show')
const latestLineAfterRun = reapplied.split(/\r?\n/).find((line) => line.includes(latestClass)) ?? ''
if (!latestLineAfterRun.includes('[X]')) {
  throw new Error(`Latest migration was not reapplied: ${latestClass}`)
}

console.log(`Migration rehearsal passed for ${latestClass}: run -> revert -> run.`)
