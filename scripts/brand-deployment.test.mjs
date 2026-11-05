import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateBrandDeployment} from '../lib/brand/deployment.mjs'
const source='a'.repeat(40), hash='b'.repeat(64)
const config=JSON.parse(readFileSync(new URL('../wrangler.kimeng.jsonc',import.meta.url)))
const stamp={brandId:'kimeng',sourceCommit:source,nextBuildId:'build',apiOrigin:'https://api.a-reit.com',workerSha256:hash,artifactSha256:hash}
test('verified Kimeng artifacts target only the separate Kimeng Worker and domains',()=>{
 assert.equal(validateBrandDeployment('kimeng',config,stamp,source,hash,hash).worker,'kimeng-frontend')
})
test('wrong brand, Worker, domain, source and missing protection all stop deployment',()=>{
 for(const changed of [{...config,name:'rwa-lat'},{...config,routes:[{pattern:'a-reit.com',custom_domain:true}]},{...config,assets:{...config.assets,run_worker_first:false}},{...config,workers_dev:true},{...config,vars:{...config.vars,KIMENG_RELEASE_MODE:'public'}}]){
  assert.throws(()=>validateBrandDeployment('kimeng',changed,stamp,source,hash,hash))
 }
 for(const changed of [{...stamp,brandId:'areit'},{...stamp,sourceCommit:'c'.repeat(40)},{...stamp,workerSha256:'d'.repeat(64)},{...stamp,artifactSha256:'e'.repeat(64)}])assert.throws(()=>validateBrandDeployment('kimeng',config,changed,source,hash,hash))
})
