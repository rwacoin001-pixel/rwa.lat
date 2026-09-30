import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(resolve(root, 'apps/api/package.json'))
const env = require('dotenv').parse(readFileSync(resolve(root, 'apps/api/.env')))
const db = new URL(env.DATABASE_URL)
if (env.APP_ENV !== 'development' || !['localhost', '127.0.0.1', '[::1]'].includes(db.hostname) || db.pathname !== '/rwa_lat_dev') throw new Error('Local development configuration required')
if (new URL(env.AI_MODEL_ENDPOINT).hostname !== 'api.deepseek.com' || env.AI_MODEL_NAME !== 'deepseek-chat') throw new Error('Only the authorized DeepSeek provider can be rehearsed')
const { ConfigService } = require('@nestjs/config')
const { AiModelClient } = require(resolve(root, 'apps/api/.local-runtime/ai/ai-model.client.js'))
try {
  const client = new AiModelClient(new ConfigService({ ...env, AI_MODEL_TIMEOUT_MS: '30000' }))
  const result = await client.complete('This is a connectivity probe. Reply briefly without any financial advice.', [{ role: 'user', content: 'Reply with connection_ok.' }], 32)
  if (!result.text.trim()) throw new Error('Empty provider response')
  console.log(JSON.stringify({ provider: 'DeepSeek', success: true, nonemptyReply: true, replyCharacters: result.text.length, credentialsPrinted: false, accountDataSent: false }))
} catch {
  console.error(JSON.stringify({ provider: 'DeepSeek', success: false, error: 'PROVIDER_CONNECTIVITY_CHECK_FAILED', credentialsPrinted: false }))
  process.exitCode = 1
}
