import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

test('email failure diagnostics expose the failing stage without recipient, OTP or provider secrets',async()=>{
 const warnings=[], exports={}
 class Unavailable extends Error { constructor(response){super(response.message);this.response=response} }
 class Logger { warn(value){warnings.push(value)} }
 const imports={
  '@nestjs/common':{Injectable:()=>()=>{},Logger,ServiceUnavailableException:Unavailable},'@nestjs/config':{},
  '../common/email-delivery.client':{EmailDeliveryClient:class{configured=true;async send(){throw Error('user@example.com 012345 secret-token')} }},
  '../common/email-template':{renderEmailTemplate:()=>({subject:'fixture',text:'fixture'}),remainingEmailMinutes:()=> '10'},
 }
 const source=ts.transpileModule(readFileSync('apps/api/src/identity/identity-delivery.service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText
 new Function('require','exports',source)(id=>imports[id],exports)
 const service=new exports.IdentityDeliveryService({get:()=>undefined})
 await assert.rejects(service.sendEmailCode({email:'user@example.com',intent:'login',code:'012345',locale:'en'}),e=>e.response.code==='AUTH_DELIVERY_FAILED')
 assert.equal(warnings.length,1)
 assert.equal(warnings[0].phase,'transport')
 assert.doesNotMatch(JSON.stringify(warnings),/user@example|012345|secret-token/)
})
