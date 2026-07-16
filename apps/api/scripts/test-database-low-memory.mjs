import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
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

function reportFailure(suite, output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '')
  const tail = clean.split(/\r?\n/).filter(Boolean).slice(-100).join('\n')
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Database suite failed: \`${suite}\`\n\n\`\`\`text\n${tail}\n\`\`\`\n`,
    )
  }
  if (process.env.GITHUB_ACTIONS === 'true') {
    const escaped = tail.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
    console.error(`::error file=${suite},title=Database suite failed::${escaped}`)
  }
  console.error(`Database suite failed: ${suite}`)
}

for (const suite of suites) {
  console.log(`Running database suite: ${suite}`)
  const result = spawnSync(
    process.execPath,
    ['--max-old-space-size=768', jestBin, '--runInBand', '--runTestsByPath', suite],
    { cwd: process.cwd(), env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  )
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) {
    reportFailure(suite, result.error.stack ?? result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    reportFailure(suite, output)
    process.exit(result.status ?? 1)
  }
}

console.log(`Low-memory database verification passed: ${suites.length} suites.`)
