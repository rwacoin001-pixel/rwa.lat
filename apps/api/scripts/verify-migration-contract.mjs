import { readFileSync, readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const migrationDir = resolve('src/database/migrations')
const files = readdirSync(migrationDir)
  .filter((file) => file.endsWith('.ts'))
  .sort((left, right) => left.localeCompare(right))

if (!files.length) throw new Error('No TypeORM migrations were found.')

let previousTimestamp = 0n
const seenTimestamps = new Set()

for (const file of files) {
  const match = /^(\d{13})-[a-z0-9-]+\.ts$/.exec(file)
  if (!match) throw new Error(`Migration filename is invalid: ${file}`)
  const timestamp = BigInt(match[1])
  if (timestamp <= previousTimestamp) throw new Error(`Migration timestamps are not strictly increasing at ${file}`)
  if (seenTimestamps.has(match[1])) throw new Error(`Duplicate migration timestamp: ${match[1]}`)
  previousTimestamp = timestamp
  seenTimestamps.add(match[1])

  const source = readFileSync(resolve(migrationDir, file), 'utf8')
  if (!/async\s+up\s*\(/.test(source) || !/async\s+down\s*\(/.test(source)) {
    throw new Error(`Migration must implement both up and down: ${file}`)
  }
  if (!source.includes(match[1])) throw new Error(`Migration class/name must include its timestamp: ${file}`)
}

const demoSeedFiles = files.filter((file) => /demo.*(?:seed|repair)|seed.*demo/i.test(file))
for (const file of demoSeedFiles) {
  const source = readFileSync(resolve(migrationDir, file), 'utf8')
  if (!source.includes('shouldApplyDemoSeed(process.env)')) {
    throw new Error(`Demo data migration is missing the production seed gate: ${basename(file)}`)
  }
}

console.log(`Migration contract passed: ${files.length} ordered migrations; ${demoSeedFiles.length} Demo data migrations are production-gated.`)
