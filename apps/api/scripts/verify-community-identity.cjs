require('reflect-metadata')
const assert = require('node:assert/strict')
const { plainToInstance } = require('class-transformer')
const { validate } = require('class-validator')
const { MemberProfileDto } = require('../dist/community/community-member.dto')
const { CommunityMemberService } = require('../dist/community/community-member.service')
;(async () => {
  const errors = handle => validate(plainToInstance(MemberProfileDto, {displayName:'小林',handle}), {whitelist:true,forbidNonWhitelisted:true})
  assert.equal((await errors('Xiao_Lin')).length,0,'User-chosen username is accepted')
  for(const handle of ['ab','a'.repeat(21),'bad space','中文','a-b']) assert((await errors(handle)).length,'Invalid username rejected')
  const profile={id:'profile-1',handle:'old_name',display_name:'小林',kind:'member',identity_configured:true,is_active:true}
  const queries=[]
  const manager={query:async(sql,args)=>{queries.push([sql,args]);if(sql.includes('SELECT status'))return[{status:'active'}];if(sql.includes('SELECT profile_id'))return[];return[]},getRepository:()=>({findOneBy:async()=>profile}),save:async p=>p}
  const service=new CommunityMemberService({transaction:async fn=>fn(manager)})
  const location={city:'深圳',countryCode:'CN',source:'device'}
  const changed=await service.updateProfile('user-1',{displayName:'林',handle:'New_Name',location})
  assert.equal(changed.handle,'new_name.sz');assert.equal(changed.identityConfigured,true)
  assert(queries.some(([sql,args])=>sql.includes('community_handle_aliases')&&args.includes('old_name')),'Old profile link reserved')
  manager.query=async(sql,args)=>sql.includes('SELECT status')?[{status:'active'}]:sql.includes('SELECT profile_id')&&args[0]==='zhangqi.sz'?[{profile_id:'someone-else'}]:[]
  assert.equal((await service.updateProfile('user-1',{displayName:'林',handle:'zhangqi',location})).handle,'zhangqi01.sz','Collision adds sequential number')
  assert.equal((await service.updateProfile('user-1',{displayName:'新昵称',handle:'zhangqi'})).handle,'zhangqi01.sz','Nickname change preserves allocated username')
  profile.identity_configured=false
  await assert.rejects(service.post('user-1','00000000-0000-4000-8000-000000000001',{body:'post',location:{city:'Singapore',countryCode:'SG',source:'device'}}),/IDENTITY_REQUIRED/)
  console.log('PASS: username validation, normalized rename, reserved old link, collision and publication identity gate')
})().catch(e=>{console.error(e);process.exitCode=1})
