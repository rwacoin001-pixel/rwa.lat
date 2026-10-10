/* Narrow operational migration. Default mode is read-only; published history is append-only. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Pool } = require(require.resolve('pg', { paths: [path.join(process.cwd(), 'apps/api')] }));
const actorHash = createHash('sha256').update('a-reit.com:domain-content-migration-service:v1').digest('hex');
const actor = `${actorHash.slice(0,8)}-${actorHash.slice(8,12)}-4${actorHash.slice(13,16)}-a${actorHash.slice(17,20)}-${actorHash.slice(20,32)}`;
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
function migrate(value) {
  if (typeof value === 'string') return value.replace(/rwa\.lat/gi, match => match === 'RWA.LAT' ? 'A-REIT' : 'a-reit.com');
  if (Array.isArray(value)) return value.map(migrate);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,migrate(v)]));
  return value;
}
function changedPaths(before, after, prefix='') {
  if (canonical(before) === canonical(after)) return [];
  if (typeof before !== 'object' || before === null) return [prefix];
  return Object.keys(before).flatMap(k => changedPaths(before[k], after[k], prefix ? `${prefix}.${k}` : k));
}
const specs = [
  {table:'ai_knowledge_items',key:'id',columns:'id,revision,draft,published,published_revision',where:'archived_at IS NULL',mode:'knowledge'},
  {table:'platform_configuration',key:'id',columns:'id,revision,draft,published,published_revision',where:'id=true',mode:'platform'},
  {table:'document_company_settings',key:'id',columns:'id,revision,content',where:'id=true',mode:'company'},
  {table:'document_templates',key:'kind',columns:'kind,revision,content',where:'true',mode:'template'},
  {table:'community_profiles',key:'id',columns:'id,kind,handle,display_name,bio,avatar_url,persona',where:"kind='official'",mode:'profile'},
  {table:'legal_documents',key:'kind',columns:'d.kind,d.revision,d.draft,d.published_revision,v.content AS published',where:'true',mode:'legal'},
];
function queryFor(spec, locking=false) {
  if (spec.mode==='legal') return `SELECT ${spec.columns} FROM app.legal_documents d LEFT JOIN app.legal_document_versions v ON v.kind=d.kind AND v.revision=d.published_revision ORDER BY d.kind${locking?' FOR UPDATE OF d':''}`;
  return `SELECT ${spec.columns} FROM app.${spec.table} WHERE ${spec.where} ORDER BY ${spec.key}${locking?' FOR UPDATE':''}`;
}
function transform(spec, row) {
  const next = JSON.parse(JSON.stringify(row));
  if (spec.mode==='profile') {
    for (const field of ['display_name','bio','avatar_url']) next[field]=migrate(row[field]);
    if (typeof row.persona?.escalate_to==='string') next.persona.escalate_to=migrate(row.persona.escalate_to.replace(/admin@rwa\.lat/gi,'support@a-reit.com'));
  } else if (spec.mode==='company') {
    // A registered legal entity and its registration details remain unchanged.
    for (const field of ['contact','website']) next.content[field]=migrate(row.content[field]);
    if (row.content.companyName==='RWA.LAT') next.content.companyName='A-REIT';
  } else if (['knowledge','platform','legal'].includes(spec.mode)) {
    next.draft=migrate(row.draft);
    next.published=migrate(row.published);
    // Publishing an unrelated administrator's pending edit would exceed this migration.
    if (next.published && hash(next)!==hash(row) && canonical(row.draft)!==canonical(row.published)) {
      throw new Error(`Unpublished edits require review: ${spec.table}/${row[spec.key]}`);
    }
    if (spec.mode==='platform') {
      if (next.draft.legalName!==row.draft.legalName || next.published?.legalName!==row.published?.legalName)
        throw new Error('Registered legal entity requires separate review');
    }
  } else next.content=migrate(row.content);
  return next;
}
function summary(plan) {
  return {kind:plan.kind,planHash:hash(plan),counts:plan.changes.reduce((acc,x)=>{acc[x.table]=(acc[x.table]||0)+1;return acc},{}),
    changes:plan.changes.map(x=>({table:x.table,id:x.id,revision:x.before.revision,newRevision:x.before.revision===undefined?undefined:x.before.revision+1,fields:x.fields}))};
}
async function audit(c, change, revision, source) {
  await c.query(`INSERT INTO app.audit_logs(actor_type,actor_id,action,object_type,object_id,request_id,metadata)
    VALUES('service',$1,'domain.a_reit.current_content_migrated',$2,$3,$4,$5::jsonb)`,
    [actor,change.table,String(change.id),randomUUID(),JSON.stringify({service:'a-reit-domain-content-migration',sourceRevision:source,
      fields:change.fields,revision,previousHash:hash(change.before),newContentHash:hash(change.after),historyRewritten:false})]);
}
async function apply(c, spec, x, source) {
  const n=x.before.revision===undefined?undefined:Math.max(x.before.revision,x.before.published_revision||0)+1;
  const data=x.after;
  const published=data.published===null?null:JSON.stringify(data.published);
  if(spec.mode==='knowledge') {
    if(data.published) await c.query('INSERT INTO app.ai_knowledge_versions(item_id,revision,content,published_by) VALUES($1,$2,$3::jsonb,$4)',[x.id,n,JSON.stringify(data.published),actor]);
    await c.query(`UPDATE app.ai_knowledge_items SET draft=$1::jsonb,revision=$2,updated_by=$3,updated_at=now(),published=$4::jsonb,
      published_revision=CASE WHEN $4::jsonb IS NULL THEN NULL ELSE $2 END,
      published_at=CASE WHEN $4::jsonb IS NULL THEN NULL ELSE now() END WHERE id=$5`,[JSON.stringify(data.draft),n,actor,published,x.id]);
  } else if(spec.mode==='platform') {
    if(data.published) await c.query('INSERT INTO app.platform_configuration_versions(revision,content,published_by) VALUES($1,$2::jsonb,$3)',[n,JSON.stringify(data.published),actor]);
    await c.query(`UPDATE app.platform_configuration SET draft=$1::jsonb,revision=$2,updated_by=$3,updated_at=now(),published=$4::jsonb,
      published_revision=CASE WHEN $4::jsonb IS NULL THEN NULL ELSE $2 END,
      published_at=CASE WHEN $4::jsonb IS NULL THEN NULL ELSE now() END WHERE id=$5`,[JSON.stringify(data.draft),n,actor,published,x.id]);
  } else if(spec.mode==='company') {
    await c.query('INSERT INTO app.document_company_versions(revision,content,created_by) VALUES($1,$2::jsonb,$3)',[n,JSON.stringify(data.content),actor]);
    await c.query('UPDATE app.document_company_settings SET revision=$1,content=$2::jsonb,updated_at=now() WHERE id=$3',[n,JSON.stringify(data.content),x.id]);
  } else if(spec.mode==='template') {
    await c.query('INSERT INTO app.document_template_versions(kind,revision,content,created_by) VALUES($1,$2,$3::jsonb,$4)',[x.id,n,JSON.stringify(data.content),actor]);
    await c.query('UPDATE app.document_templates SET revision=$1,content=$2::jsonb,updated_at=now() WHERE kind=$3',[n,JSON.stringify(data.content),x.id]);
  } else if(spec.mode==='legal') {
    if(data.published) await c.query('INSERT INTO app.legal_document_versions(kind,revision,version,content,published_by) VALUES($1,$2,$3,$4::jsonb,$5)',[x.id,n,`${x.id}-${n}`,JSON.stringify(data.published),actor]);
    await c.query('UPDATE app.legal_documents SET draft=$1::jsonb,revision=$2,published_revision=CASE WHEN $3 THEN $2 ELSE NULL END,updated_at=now(),updated_by=$4 WHERE kind=$5',[JSON.stringify(data.draft),n,!!data.published,actor,x.id]);
  } else if(spec.mode==='profile') {
    await c.query("UPDATE app.community_profiles SET display_name=$1,bio=$2,avatar_url=$3,persona=$4::jsonb,updated_at=now() WHERE id=$5 AND kind='official'",[data.display_name,data.bio,data.avatar_url,JSON.stringify(data.persona),x.id]);
  }
  await audit(c,x,n,source);
}
(async()=>{
  const [mode, file, expectedHash, source]=process.argv.slice(2);
  if(mode==='--summary') {const parsed=JSON.parse(fs.readFileSync(file,'utf8'));console.log(JSON.stringify(summary(parsed.plan??parsed)));return}
  if(!['--plan','--apply'].includes(mode)) throw new Error('Use --plan, --summary PLAN or --apply PLAN PLAN_HASH MERGED_SOURCE_SHA');
  if(!process.env.PRODUCTION_DATABASE_URL) throw new Error('Production database configuration is required');
  const pool=new Pool({connectionString:process.env.PRODUCTION_DATABASE_URL,connectionTimeoutMillis:10000,max:1});
  const c=await pool.connect();
  try {
    await c.query(mode==='--plan'?'BEGIN READ ONLY':'BEGIN');
    await c.query("SET LOCAL lock_timeout='5s'");
    await c.query("SET LOCAL statement_timeout='30s'");
    const live=new Map();
    for(const spec of specs) live.set(spec.table,(await c.query(queryFor(spec,mode==='--apply'))).rows);
    if(mode==='--plan') {
      const changes=[];
      for(const spec of specs) for(const before of live.get(spec.table)) {
        const after=transform(spec,before), fields=changedPaths(before,after);
        if(fields.length) changes.push({table:spec.table,id:before[spec.key],before,after,fields});
      }
      await c.query('ROLLBACK');
      const plan={kind:'a-reit-current-content-v1',createdAt:new Date().toISOString(),serviceActor:actor,changes};
      console.log(JSON.stringify({plan,summary:summary(plan)}));
    } else {
      const stat=fs.statSync(file);
      if(stat.mode & 0o077) throw new Error('Private reviewed plan requires mode 0600 or stricter');
      const parsed=JSON.parse(fs.readFileSync(file,'utf8')),plan=parsed.plan??parsed;
      if(plan.kind!=='a-reit-current-content-v1'||hash(plan)!==expectedHash||plan.serviceActor!==actor||!/^[0-9a-f]{40}$/.test(source||'')) throw new Error('Reviewed plan or merged revision mismatch');
      const currentKeys=[];
      for(const spec of specs) for(const row of live.get(spec.table)) if(hash(row)!==hash(transform(spec,row))) currentKeys.push(`${spec.table}/${row[spec.key]}`);
      if(canonical(currentKeys.sort())!==canonical(plan.changes.map(x=>`${x.table}/${x.id}`).sort())) throw new Error('Current migration scope changed; prepare a new plan');
      for(const x of plan.changes) {
        const spec=specs.find(s=>s.table===x.table);
        if(!spec) throw new Error('Table is outside the reviewed migration scope');
        const current=live.get(spec.table).find(row=>row[spec.key]===x.id);
        if(!current||hash(current)!==hash(x.before)||hash(transform(spec,current))!==hash(x.after)||canonical(changedPaths(current,x.after))!==canonical(x.fields))
          throw new Error(`Current content changed; prepare a new plan: ${x.table}/${x.id}`);
      }
      for(const x of plan.changes) await apply(c,specs.find(s=>s.table===x.table),x,source);
      await c.query('COMMIT');
      console.log(JSON.stringify({...summary(plan),applied:true,sourceRevision:source,serviceActor:actor}));
    }
  } catch(e) {await c.query('ROLLBACK');throw e} finally {c.release();await pool.end()}
})().catch(e=>{console.error(JSON.stringify({error:e.code||e.name,message:e.code?'Database operation failed':e.message}));process.exitCode=1});
