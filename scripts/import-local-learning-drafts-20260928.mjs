import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Imports only the editorial bundle as local, unpublished drafts through the
// existing ContentService.save method. No session secret is read or printed.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(resolve(root,'apps/api/package.json'))
const config=require('dotenv').parse(readFileSync(resolve(root,'apps/api/.env')))
const url=new URL(config.DATABASE_URL)
if(config.APP_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||decodeURIComponent(url.pathname.slice(1))!=='rwa_lat_dev') throw Error('Only local development rwa_lat_dev can receive editorial drafts')
if(process.argv[2]!=='--import' || process.argv.length!==3) throw Error('Explicit --import required')

const folder=resolve(root,'docs/content-library/20260928')
const articles=JSON.parse(readFileSync(resolve(folder,'articles.import.json'),'utf8'))
const manifest=JSON.parse(readFileSync(resolve(folder,'manifest.json'),'utf8'))
if(articles.length!==84||manifest.articleCount!==84||createHash('sha256').update(JSON.stringify(articles)).digest('hex')!==manifest.sha256) throw Error('Editorial bundle integrity check failed')
const keys=new Set()
for(const row of articles){
  const key=`${row.slug}:${row.locale}`
  if(keys.has(key)|| !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug)|| !['zh-CN','en','hi','es','ar','fr','pt'].includes(row.locale)|| !row.title?.trim()|| !row.body?.trim()|| !row.author?.trim()) throw Error('Invalid editorial row')
  keys.add(key)
}

const {DataSource}=require('typeorm')
const {ContentService}=require(resolve(root,'apps/api/dist/content/content.service.js'))
const source=await new DataSource({type:'postgres',url:url.toString(),schema:'app',entities:[],synchronize:false,logging:false}).initialize()
try{
  const result=await source.transaction(async tx=>{
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('rwa.lat.content.library.20260928'))")
    const authorized=await tx.query("SELECT u.id FROM app.admin_users u JOIN app.admin_role_permissions p ON p.role_id=u.role_id AND p.permission='platform.manage' WHERE u.disabled_at IS NULL")
    if(authorized.length!==1) throw Error('Expected one active local content administrator; no drafts imported')
    const existing=await tx.query("SELECT count(*)::int AS count FROM app.learning_articles")
    if(existing[0].count!==0) throw Error('Existing editorial rows detected; no drafts imported')
    // The service expects DataSource.transaction; keep all saves and their audit
    // records inside one outer transaction, so an error rolls back every row.
    const service=new ContentService({transaction:fn=>fn(tx)})
    for(const row of articles) await service.save(null,row,authorized[0].id)
    const [tally]=await tx.query("SELECT count(*)::int AS total,count(*) FILTER (WHERE published IS NOT NULL)::int AS public_count,count(DISTINCT slug)::int AS topics,count(DISTINCT locale)::int AS languages FROM app.learning_articles")
    if(tally.total!==84||tally.public_count!==0||tally.topics!==12||tally.languages!==7) throw Error('Draft-only postcondition failed')
    return {database:'rwa_lat_dev',drafts:tally.total,topics:tally.topics,languages:tally.languages,published:tally.public_count,mode:'ContentService.save + audit, one transaction'}
  })
  console.log(JSON.stringify(result))
}catch{
  console.error('Local editorial import failed and was rolled back; no private data printed')
  process.exitCode=1
}finally{await source.destroy()}
