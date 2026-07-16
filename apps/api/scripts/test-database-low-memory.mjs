import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required.')

const suites = [
  'test/identity-schema.integration.spec.ts',
  'test/wallet-ledger-schema.integration.spec.ts',
  'test/ledger-reconciliation-schema.integration.spec.ts',
  'test/polymarket-schema.integration.spec.ts',
  'test/catalog/catalog.integration.spec.ts',
  'test/identity/identity.integration.spec.ts',
  'test/admin-rbac/admin-rbac.service.spec.ts',
  'test/admin-rbac/admin-rbac.integration.spec.ts',
  'test/data-governance/data-governance.service.spec.ts',
  'test/job-queue/job-queue.service.spec.ts',
  'test/notification/notification.integration.spec.ts',
  'test/notification/user-ops.integration.spec.ts',
  'test/portfolio/portfolio.integration.spec.ts',
]

const jestBin = resolve('node_modules/jest/bin/jest.js')
const env = { ...process.env, NODE_ENV: 'test', APP_ENV: 'test' }

for (const suite of suites) {
  const result = spawnSync(
    process.execPath,
    ['--max-old-space-size=768', jestBin, '--runInBand', '--runTestsByPath', suite],
    { cwd: process.cwd(), env, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 },
  )
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) throw result.error
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    const tail = output.split(/\r?\n/).filter(Boolean).slice(-80).join('\n')
    if (process.env.GITHUB_ACTIONS === 'true') {
      const escaped = tail.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
      console.error(`::error file=${suite},title=Database suite failed::${escaped}`)
    }
    console.error(`Database suite failed: ${suite}`)
    process.exit(result.status ?? 1)
  }
}

console.log(`Low-memory database verification passed: ${suites.length} suites.`)
