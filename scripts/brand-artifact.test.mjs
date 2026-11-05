import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {artifactDigest} from '../lib/brand/artifact.mjs'
test('artifact integrity covers server code and assets while excluding its own stamp',()=>{
 const base=resolve('.task-artifacts'),dir=mkdtempSync(join(base,'kimeng-hash-test-'))
 try{
  mkdirSync(join(dir,'assets'));mkdirSync(join(dir,'server-functions'))
  writeFileSync(join(dir,'worker.js'),'worker');writeFileSync(join(dir,'server-functions','index.mjs'),'server')
  writeFileSync(join(dir,'assets','brand.svg'),'kimeng');const original=artifactDigest(dir)
  assert.equal(artifactDigest(pathToFileURL(dir)),original)
  writeFileSync(join(dir,'brand-build.json'),'stamp');assert.equal(artifactDigest(dir),original)
  writeFileSync(join(dir,'assets','brand.svg'),'other-brand');assert.notEqual(artifactDigest(dir),original)
  writeFileSync(join(dir,'assets','brand.svg'),'kimeng');writeFileSync(join(dir,'server-functions','index.mjs'),'other-code');assert.notEqual(artifactDigest(dir),original)
 }finally{if(!dir.startsWith(base+'\\')&&!dir.startsWith(base+'/'))throw new Error('Unsafe test cleanup target');rmSync(dir,{recursive:true,force:true})}
})
