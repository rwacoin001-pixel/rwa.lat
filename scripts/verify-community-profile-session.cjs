const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('../node_modules/typescript')
let session={userId:'alice'},cursor=0,states=[],effects=[],resolve,events=[]
global.window={addEventListener(){},removeEventListener(){},dispatchEvent:e=>events.push(e),setInterval,clearInterval}
global.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail}}
const filename=require('node:path').resolve(__dirname,'../lib/use-community-me.ts'),fixture=new Module(filename)
fixture.require=name=>name==='react'?{useState:init=>{const i=cursor++;if(!(i in states))states[i]=init;return[states[i],v=>states[i]=v]},useEffect:fn=>effects.push(fn)}:{readSession:()=>session,SESSION_CHANGED:'session',request:()=>new Promise(r=>resolve=r)}
fixture._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename)
;(async()=>{
 fixture.exports.useCommunityMe(false);effects[0]()
 const fresh={id:'alice-profile',displayName:'Updated Alice'}
 assert(fixture.exports.publishCommunityMe(fresh,'alice'))
 resolve({ok:true,data:{id:'alice-profile',displayName:'Stale Alice'}});await new Promise(r=>setImmediate(r))
 assert.equal(events.length,1,'An older GET cannot overwrite a profile mutation')
 assert.equal(events[0].detail.displayName,'Updated Alice')
 session={userId:'bob'}
 assert.equal(fixture.exports.publishCommunityMe(fresh,'alice'),false,'Late mutation cannot enter another account cache')
 assert.equal(events.length,1)
 console.log('PASS: late mutation ownership and stale GET invalidation')
})().catch(e=>{console.error(e);process.exitCode=1})
