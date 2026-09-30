import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// Extend the locally running API's complete schema with the independently compiled legal controller.
// This reads OpenAPI JSON only; it does not access a website page or a browser session.
const root=resolve(import.meta.dirname,'..')
const require=createRequire(resolve(root,'apps/api/package.json'))
process.env.NODE_PATH=[resolve(root,'apps/api/node_modules'),resolve(root,'apps/admin/node_modules')].join(process.platform === 'win32' ? ';' : ':')
require('node:module').Module._initPaths()
const { Test }=require('@nestjs/testing'), { SwaggerModule, DocumentBuilder }=require('@nestjs/swagger'), { DataSource }=require('typeorm')
const { LegalController }=require(resolve(root,'tmp/build-verification-legal-20260928/api/legal/legal.controller.js'))
const response=await fetch('http://127.0.0.1:4000/v1/docs-json',{signal:AbortSignal.timeout(5000)})
if(!response.ok) throw new Error('Local API OpenAPI JSON is unavailable')
const existing=await response.json()
const module=await Test.createTestingModule({controllers:[LegalController],providers:[{provide:DataSource,useValue:{query:async()=>[]}}]}).compile()
const app=module.createNestApplication({logger:false});app.setGlobalPrefix('v1')
try {
  await app.init()
  const added=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Legal contract').setVersion('1').build())
  Object.assign(existing.paths,added.paths)
  existing.components??={};existing.components.schemas??={}
  for(const [key,value] of Object.entries(added.components.schemas)) {
    if(existing.components.schemas[key] && JSON.stringify(existing.components.schemas[key])!==JSON.stringify(value)) throw new Error(`Schema collision: ${key}`)
    existing.components.schemas[key]=value
  }
  const directory=resolve(root,'tmp/legal-contract-20260928');mkdirSync(directory,{recursive:true})
  const file=resolve(directory,'openapi.json');writeFileSync(file,JSON.stringify(existing))
  const generated=spawnSync(process.execPath,[resolve(root,'node_modules/openapi-typescript/bin/cli.js'),file,'-o',resolve(root,'lib/api/schema.d.ts')],{cwd:root,stdio:'inherit',windowsHide:true})
  if(generated.status!==0)throw new Error('OpenAPI type generation failed')
} finally {await app.close()}
