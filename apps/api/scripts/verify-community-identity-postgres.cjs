require('reflect-metadata')
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{DataSource}=require('typeorm')
const {CommunityProfile}=require('../dist/community/community.entities')
const {CommunityMemberService}=require('../dist/community/community-member.service')
const {CommunityIdentity1791000000000}=require('../dist/database/migrations/1791000000000-community-identity')
;(async()=>{
 const url=new URL(process.env.COMMUNITY_TEST_DATABASE_URL||'')
 assert(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.endsWith('_test'),'Isolated local test database required')
 const db=new DataSource({type:'postgres',url:url.href,entities:[CommunityProfile],synchronize:false})
 await db.initialize()
 try{
 await db.query('CREATE SCHEMA app');await db.synchronize()
 await db.query("CREATE TABLE app.users(id uuid PRIMARY KEY,status text DEFAULT 'active'); CREATE TABLE app.community_translations(id uuid,source_hash varchar(64)); ALTER TABLE app.community_profiles DROP COLUMN identity_configured; ALTER TABLE app.community_profiles DROP COLUMN handle_base;")
 const migration=new CommunityIdentity1791000000000();await migration.up(db.createQueryRunner())
 const service=new CommunityMemberService(db),location={city:'深圳',countryCode:'CN',source:'device'}
 const users=Array.from({length:8},()=>randomUUID());for(const id of users)await db.query('INSERT INTO app.users(id)VALUES($1)',[id])
 const profiles=await Promise.all(users.slice(0,6).map(user=>service.updateProfile(user,{displayName:'测试',handle:'zhangqi',location})))
 assert.equal(new Set(profiles.map(p=>p.handle)).size,6)
 assert.deepEqual(profiles.map(p=>p.handle).sort(),['zhangqi.sz','zhangqi01.sz','zhangqi02.sz','zhangqi03.sz','zhangqi04.sz','zhangqi05.sz'].sort())
 const old=profiles[0].handle,id=profiles[0].id
 const renamed=await service.updateProfile(users[0],{displayName:'新昵称',handle:'new_name',location})
 assert.equal(renamed.id,id);assert.equal((await db.query('SELECT profile_id FROM app.community_handle_aliases WHERE handle=$1',[old]))[0].profile_id,id)
 const overlap=await Promise.all([service.updateProfile(users[6],{displayName:'A',handle:'zhangqi',location}),service.updateProfile(users[7],{displayName:'B',handle:'zhangqi06',location})])
 assert.equal(new Set(overlap.map(p=>p.handle)).size,2,'Literal base cannot race with numbered candidate')
 console.log('PASS: additive migration, 6 concurrent claims, numbered/literal overlap, stable ID and old alias')
 }finally{await db.destroy()}
})().catch(e=>{console.error(e);process.exitCode=1})
