const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('../node_modules/typescript')
let cursor=0,states=[],refs=[],locale='zh-CN',calls=0,fail=false,release,pending=[]
const react={useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}]},useRef:initial=>{const i=cursor++;return refs[i]??={current:initial}},useEffect:fn=>{pending.push(fn)}}
const observers=[];globalThis.ResizeObserver=class{constructor(cb){this.cb=cb;this.alive=true;observers.push(this)}observe(){}disconnect(){this.alive=false}}
const flushEffects=()=>pending.splice(0).map(fn=>fn()).filter(Boolean)
const jsx=(type,props)=>({type,props})
const filename=require('node:path').resolve(__dirname,'../components/community-text.tsx'),fixture=new Module(filename)
const copyModule=new Module('copy');copyModule._compile(ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname,'../lib/community-experience-copy.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,'copy')
fixture.require=name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='@/lib/i18n'?{useI18n:()=>({locale})}:name==='@/lib/community-experience-copy'?copyModule.exports:name==='@/lib/api/_http'?{request:async(_,options)=>{calls++;assert.equal(JSON.parse(options.body).targetLang,locale==='zh-CN'?'zh-Hans':locale);await new Promise(r=>{release=r});return fail?{ok:false,error:{code:'FAIL'}}:{ok:true,data:{text:'Translated:'+locale,sourceLang:'en'}}}}:{default:{root:'root',text:'text',body:'body',open:'open',controls:'controls'}}
fixture._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename)
const {CommunityText}=fixture.exports
let props={body:'Original English post',targetId:'p1'}
const render=()=>{cursor=0;return CommunityText(props)}
const walk=(node,out=[])=>{if(!node)return out;if(Array.isArray(node)){for(const n of node)walk(n,out)}else if(typeof node==='object'){out.push(node);walk(node.props?.children,out)}return out}
const texts=node=>walk(node).flatMap(n=>Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).filter(x=>typeof x==='string')
const translateButton=tree=>walk(tree).filter(n=>n.type==='button').at(-1)
;(async()=>{
 let tree=render();assert.equal(calls,0,'No automatic model requests')
 translateButton(tree).props.onClick();tree=render();assert(translateButton(tree).props.disabled)
 release();await new Promise(r=>setImmediate(r));tree=render();assert(texts(tree).includes('Translated:zh-CN'))
 translateButton(tree).props.onClick();tree=render();assert(texts(tree).includes(props.body),'Original toggles in place')
 translateButton(tree).props.onClick();assert.equal(calls,1,'Reuses cached translation')
 locale='es';tree=render();assert(texts(tree).includes(props.body),'Language change hides previous translation')
 fail=true;translateButton(tree).props.onClick();release();await new Promise(r=>setImmediate(r));tree=render();assert(texts(tree).includes(props.body));assert(texts(tree).includes(copyModule.exports.communityExperienceCopy.es.retry))
 fail=false;translateButton(tree).props.onClick();locale='fr';render();release();await new Promise(r=>setImmediate(r));tree=render();assert(texts(tree).includes(props.body),'Late response cannot overwrite new locale')
 locale='es';tree=render();assert(!translateButton(tree).props.disabled,'Returning to pending locale never leaves translation stuck')
 for(const value of ['en','zh-CN','hi','es','ar','fr','pt'])assert(Object.values(copyModule.exports.communityExperienceCopy[value]).every(x=>typeof x==='string'&&x.length))
 let stopped=false;walk(tree).find(n=>n.props?.className==='controls')?.props?.onClick?.({stopPropagation:()=>{stopped=true}});assert(stopped,'Translation controls never navigate the parent post')
 const bodyNode=t=>walk(t).find(n=>n.type==='p'),buttons=t=>walk(t).filter(n=>n.type==='button'),expandLabel=()=>copyModule.exports.communityExperienceCopy[locale]
 states=[];refs=[];pending.length=0;props={body:'长'.repeat(100),targetId:'p-long',compact:true}
 const box={scrollHeight:120,clientHeight:80};tree=render();bodyNode(tree).props.ref.current=box
 assert(!texts(tree).includes(expandLabel().expand),'No Expand before the first measurement')
 let cleanups=flushEffects();tree=render();assert(texts(tree).includes(expandLabel().expand),'Text that wraps past the clamp exposes Expand')
 assert.equal(bodyNode(tree).props['data-collapsed'],true)
 buttons(tree)[0].props.onClick();tree=render();assert(texts(tree).includes(expandLabel().collapse)&&bodyNode(tree).props['data-collapsed']===false,'Expand toggles in place')
 assert(observers.at(-1).alive===true);cleanups.forEach(fn=>fn());assert(observers.at(-1).alive===false,'Observer disconnects on cleanup')
 props={...props,targetId:'p-other'};box.scrollHeight=80;tree=render();assert.equal(bodyNode(tree).props['data-collapsed'],true,'Expansion resets for a different post')
 assert(!texts(tree).includes(expandLabel().expand),'Stale measurement is not reused for a different post')
 pending.length=0;tree=render();cleanups=flushEffects();tree=render();assert(!texts(tree).includes(expandLabel().expand)&&!texts(tree).includes(expandLabel().collapse),'Text that fits the clamp has no Expand')
 box.scrollHeight=200;observers.at(-1).cb();tree=render();assert(texts(tree).includes(expandLabel().expand),'Resize re-measures and exposes Expand')
 props={body:'Short',targetId:'p-open',compact:true,onOpen:()=>{opened=true}};let opened=false;tree=render()
 const open=buttons(tree).find(n=>n.props.className==='open');assert(open&&open.props['aria-label']===expandLabel().open,'Open post is a labelled button');open.props.onClick();assert(opened,'Open button opens the post')
 console.log('PASS: manual translation, original toggle, cached repeat, locale isolation, failure/retry, measured expansion, open button and seven-language copy')
})().catch(e=>{console.error(e);process.exitCode=1})
