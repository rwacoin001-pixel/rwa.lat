import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ConfigService } from '@nestjs/config'
import dataSource from '../src/database/data-source'
import { AiKnowledgeService } from '../src/ai/ai-knowledge.service'

// Explicit operator action only; never imported by application startup or migrations.
async function main() {
  const articles = ['zh', 'en'].flatMap(locale => JSON.parse(readFileSync(resolve(__dirname, `../src/ai/knowledge/generated/${locale}.json`), 'utf8')))
  await dataSource.initialize()
  try { console.log(JSON.stringify(await new AiKnowledgeService(dataSource, new ConfigService()).syncGenerated(articles))) }
  finally { await dataSource.destroy() }
}
void main().catch(() => { console.error('Knowledge seed failed; no connection details are logged.'); process.exitCode = 1 })
