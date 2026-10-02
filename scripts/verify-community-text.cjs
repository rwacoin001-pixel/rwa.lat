const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('../node_modules/typescript')
let cursor=0,states=[],refs=[],locale='zh-CN',calls=0,fail=false,release
const react={useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=v}]},useRef:initial=>{const i=cursor++;return refs[i]??={current:initial}}}
const jsx=(type,props)=>({type,props})
const filename=require('node:path').resolve(__dirname,'../components/community-text.tsx'),fixture=new Module(filename)
const copyModule=new Module('copy');copyModule._compile(ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname,'../lib/community-experience-copy.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,'copy')
fixture.require=name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='@/lib/i18n'?{useI18n:()=>({locale})}:name==='@/lib/community-experience-copy'?copyModule.exports:name==='@/lib/api/_http'?{request:async(_,options)=>{calls++;assert.equal(JSON.parse(options.body).targetLang,locale==='zh-CN'?'zh-Hans':locale);await new Promise(r=>{release=r});return fail?{ok:false,error:{code:'FAIL'}}:{ok:true,data:{text:'Translated:'+locale,sourceLang:'en'}}}}:{default:{root:'root',body:'body',controls:'controls'}}
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
 console.log('PASS: manual translation, original toggle, cached repeat, locale isolation, failure/retry and seven-language copy')
})().catch(e=>{console.error(e);process.exitCode=1})
