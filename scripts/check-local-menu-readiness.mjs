import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Local engineering metadata only. No user data, document content, credentials,
// identifiers or signed download links are included in this report.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(resolve(root,'apps/api/package.json'))
const config=require('dotenv').parse(readFileSync(resolve(root,'apps/api/.env')))
const url=new URL(config.DATABASE_URL)
if(config.APP_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/rwa_lat_dev') throw new Error('Only the local development database may be inspected')
const {Client}=require('pg')
const db=new Client({connectionString:url.toString()})
try{
  await db.connect()
  await db.query('BEGIN READ ONLY')
  const publication=(await db.query('SELECT published IS NOT NULL AS published,published_revision AS revision FROM app.platform_configuration WHERE id=true')).rows[0]??{published:false}
  const legalTable=(await db.query("SELECT to_regclass('app.legal_documents') IS NOT NULL AS present")).rows[0].present
  const legalPublications=legalTable?(await db.query('SELECT kind,revision,published_revision AS "publishedRevision" FROM app.legal_documents ORDER BY kind')).rows:[]
  const articles=(await db.query('SELECT locale,count(*)::int AS count FROM app.learning_articles WHERE published IS NOT NULL AND archived_at IS NULL GROUP BY locale ORDER BY locale')).rows
  const templates=(await db.query("SELECT kind,revision,content->>'enabled'='true' AS enabled FROM app.document_templates ORDER BY kind")).rows
  const company=(await db.query("SELECT length(trim(content->>'registration'))>0 AS registration_present FROM app.document_company_settings WHERE id=true")).rows[0]
  const documents=(await db.query('SELECT d.kind,d.state,o.scan_status,count(*)::int AS count FROM app.generated_documents d LEFT JOIN app.object_storage_objects o ON o.id=d.object_id GROUP BY d.kind,d.state,o.scan_status ORDER BY d.kind,d.state,o.scan_status')).rows
  await db.query('ROLLBACK')
  console.log(JSON.stringify({environment:'local development',database:'rwa_lat_dev',readOnly:true,publication,legalPublications,articles,templates,company,documents,
    configuration:{scanRequired:config.OBJECT_STORAGE_REQUIRE_SCAN!=='false',scanProvider:config.OBJECT_STORAGE_SCAN_PROVIDER??'unconfigured',documentWorkerEnabled:config.DOCUMENT_GENERATION_WORKER_ENABLED!=='false',recurringWorkerEnabled:config.RECURRING_INVESTMENT_WORKER_ENABLED==='true',mailWorkerEnabled:config.NOTIFICATION_DELIVERY_WORKER_ENABLED==='true',mailProviderConfigured:Boolean(config.EMAIL_PROVIDER&&config.EMAIL_FROM&&(config.EMAIL_PROVIDER==='resend'?config.RESEND_API_KEY:config.SMTP_HOST)),aiConfigured:Boolean(config.AI_MODEL_ENDPOINT&&config.AI_MODEL_NAME&&config.AI_MODEL_API_KEY)},
    acceptance:{browser:'not completed',production:'not completed',actualBusinessContent:'not verified',realEmailDelivery:'not verified',completeIsolatedDatabaseQueue:'not assessed by this read-only database check'}},null,2))
}catch{
  console.error('Local readiness metadata unavailable; no private data or credentials were printed.')
  process.exitCode=1
}finally{await db.end()}
