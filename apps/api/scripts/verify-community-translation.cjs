require('reflect-metadata')
const assert=require('node:assert/strict')
const {CommunityService}=require('../dist/community/community.service')
;(async()=>{
  let calls=0,cache=null
  const post={id:'p',body:'Hello world',lang:'en',state:'published'}
  const translations={findOne:async()=>cache,create:row=>row,save:async row=>{cache=row},upsert:async row=>{cache=row}}
  const provider={isConfigured:()=>true,translate:async text=>{calls++;await new Promise(r=>setTimeout(r,10));return '译文:'+text}}
  const service=new CommunityService({}, {findOne:async()=>post}, {}, {}, {}, {}, {}, {}, translations,provider,{})
  const dto={targetType:'post',targetId:'p',targetLang:'zh-CN'}
  const results=await Promise.all([service.translateTarget(dto),service.translateTarget(dto)])
  assert.equal(calls,1,'Concurrent translations share one model request')
  assert.equal(results[0].targetLang,'zh-Hans','App Chinese locale maps to translation locale')
  await service.translateTarget(dto);assert.equal(calls,1)
  post.body='Changed body';await service.translateTarget(dto);assert.equal(calls,2,'Edited content invalidates cache')
  post.lang='zh-Hans';post.body='English text entered with a Chinese app';await service.translateTarget(dto);assert.equal(calls,3,'App locale cannot prevent translation of a differently written post')
  post.state='hidden';await assert.rejects(service.translateTarget(dto),/POST_NOT_FOUND/)
  console.log('PASS: locale mapping, concurrent request merge, versioned cache, moderation boundary')
})().catch(e=>{console.error(e);process.exitCode=1})
