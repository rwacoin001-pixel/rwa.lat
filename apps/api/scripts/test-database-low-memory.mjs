import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { appendFileSync, writeSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { Client } from 'pg'

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required.')

const testUrl = new URL(process.env.TEST_DATABASE_URL)
const testDatabaseName = decodeURIComponent(testUrl.pathname.slice(1))
if (!testDatabaseName.endsWith('_test')) throw new Error('Refusing to reset a database whose name does not end in _test.')
if (process.env.DATABASE_URL) {
  const devUrl = new URL(process.env.DATABASE_URL)
  const target = (url) => `${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname}`
  if (target(testUrl) === target(devUrl)) throw new Error('Refusing to reset TEST_DATABASE_URL because it matches DATABASE_URL.')
}

const suites = [
  'test/identity-schema.integration.spec.ts',
  'test/wallet-ledger-schema.integration.spec.ts',
  'test/wallet/wallet-ledger-transfer.integration.spec.ts',
  'test/ledger-reconciliation-schema.integration.spec.ts',
  'test/polymarket-schema.integration.spec.ts',
  'test/catalog/catalog.integration.spec.ts',
  'test/identity/identity.integration.spec.ts',
  'test/identity/email-code.integration.spec.ts',
  'test/legal/legal-publications.integration.spec.ts',
  'test/admin-rbac/admin-rbac.service.spec.ts',
  'test/admin-rbac/admin-rbac.integration.spec.ts',
  'test/data-governance/data-governance.service.spec.ts',
  'test/job-queue/job-queue.service.spec.ts',
  'test/notification/notification.integration.spec.ts',
  'test/notification/user-ops.integration.spec.ts',
  'test/portfolio/portfolio.integration.spec.ts',
  'test/orders/recurring-investment.integration.spec.ts',
  'test/orders/manual-settlement.integration.spec.ts',
  'test/notification/notification-delivery.integration.spec.ts',
  'test/content/content.integration.spec.ts',
  'test/community/community-member.integration.spec.ts',
  'test/ai/ai-planning.integration.spec.ts',
  'test/notification/account-closure.integration.spec.ts',
  'test/generated-documents/generated-documents.integration.spec.ts',
  'test/sharing/public-share.integration.spec.ts',
  'test/basket/basket-flow.integration.spec.ts',
  'test/community/community.integration.spec.ts',
  'test/rwa-analysis/ai-analysis.spec.ts',
  'test/rwa-analysis/scoring.integration.spec.ts',
  'test/rwa-basket/rwa-basket-schema.integration.spec.ts',
  'test/rwa-market/rwa-market-query.integration.spec.ts',
  'test/rwa-market/rwa-sync.integration.spec.ts',
]

const heapMb = Number(process.env.TEST_DATABASE_HEAP_MB ?? '768')
if (!Number.isInteger(heapMb) || heapMb < 256 || heapMb > 4096) throw new Error('TEST_DATABASE_HEAP_MB must be an integer from 256 to 4096.')
const timeoutMs = Number(process.env.TEST_DATABASE_TIMEOUT_MS ?? '120000')
if (!Number.isInteger(timeoutMs) || timeoutMs < 30000 || timeoutMs > 300000) throw new Error('TEST_DATABASE_TIMEOUT_MS must be an integer from 30000 to 300000.')
const args = process.argv.slice(2)
const resumeFrom = args[0] === '--resume-from' && args.length === 2 ? args[1] : undefined
if (args.length && !resumeFrom) throw new Error('Usage: test-database-low-memory.mjs [--resume-from suite-path]')
const resumeIndex = resumeFrom ? suites.indexOf(resumeFrom) : 0
if (resumeIndex < 0) throw new Error('The resume suite must be a listed database suite.')

const require = createRequire(import.meta.url)
const jestBin = resolve(dirname(require.resolve('jest/package.json')), 'bin/jest.js')
const typeormCli = resolve(dirname(require.resolve('typeorm')), 'cli-ts-node-commonjs.js')
const env = { ...process.env, NODE_ENV: 'test', APP_ENV: 'test' }

const testDb = new Client({ connectionString: process.env.TEST_DATABASE_URL })
await testDb.connect()
const { rows: databaseRows } = await testDb.query('SELECT current_database()')
const connectedDatabase = databaseRows[0]?.current_database
if (connectedDatabase !== testDatabaseName || !connectedDatabase.endsWith('_test')) {
  await testDb.end()
  throw new Error('Refusing to reset: connected database does not match the dedicated _test target.')
}
if (!resumeFrom) {
  await testDb.query('DROP SCHEMA IF EXISTS app CASCADE')
  await testDb.query('DROP TABLE IF EXISTS public.schema_migrations')
}
await testDb.end()

const migrations = spawnSync(
  process.execPath,
  [typeormCli, 'migration:run', '-d', 'src/database/data-source.ts'],
  { cwd: process.cwd(), env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
)
if (migrations.error || migrations.status !== 0) {
  const output = `${migrations.stdout ?? ''}\n${migrations.stderr ?? ''}`
  const tail = output.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/).filter(Boolean).slice(-80).join('\n')
  if (tail) writeSync(2, `${tail}\n`)
  throw migrations.error ?? new Error(`Preparing isolated test database failed with exit code ${migrations.status}.`)
}
writeSync(1, `Prepared isolated database ${testDatabaseName} with current migrations.\n`)

function reportFailure(suite, output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '')
  const tail = clean.split(/\r?\n/).filter(Boolean).slice(-100).join('\n')
  if (process.env.GITHUB_ACTIONS === 'true') {
    const escaped = tail.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
    writeSync(2, `::error file=${suite},title=Database suite failed::${escaped}\n`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## Database suite failed: \`${suite}\`\n\n\`\`\`text\n${tail}\n\`\`\`\n`,
      )
    } catch (error) {
      writeSync(2, `Could not write the database failure summary: ${error.message}\n`)
    }
  }
  if (tail) writeSync(2, `${tail}\n`)
  writeSync(2, `Database suite failed: ${suite}\n`)
}

function reportProgress(suite, state) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    writeSync(1, `::notice file=${suite},title=Database suite ${state}::${suite}\n`)
  }
}

for (const [index, suite] of suites.entries()) {
  if (index < resumeIndex) continue
  writeSync(1, `Running database suite: ${suite}\n`)
  if (index >= 5) reportProgress(suite, 'started')
  const result = spawnSync(
    process.execPath,
    [`--max-old-space-size=${heapMb}`, jestBin, '--runInBand', `--testTimeout=${timeoutMs}`, '--runTestsByPath', suite],
    { cwd: process.cwd(), env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  )
  if (result.error) {
    reportFailure(suite, result.error.stack ?? result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    writeSync(2, output.replace(/\u001b\[[0-9;]*m/g, ''))
    reportFailure(suite, output)
    process.exit(result.status ?? 1)
  }
  if (result.stdout) writeSync(1, result.stdout)
  if (result.stderr) writeSync(2, result.stderr)
}

console.log(`Isolated database verification passed: ${suites.length - resumeIndex} suites${resumeFrom ? ' (resumed; earlier suites were not rerun)' : ''}.`)
