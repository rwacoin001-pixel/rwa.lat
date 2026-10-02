const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('../node_modules/typescript')
let me=null,broken=null
const jsx=(type,props)=>({type,props})
const filename=require('node:path').resolve(__dirname,'../components/community-avatar.tsx'),fixture=new Module(filename)
fixture.require=name=>name==='react'?{useState:()=>[broken,v=>broken=v],useEffect:()=>undefined}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='@/lib/api/_http'?{apiUrl:p=>'https://api.test'+p}:name==='@/lib/use-notionist'?{useNotionist:seed=>'data:portrait:'+seed}:name==='@/lib/use-community-me'?{useCommunityProfileSnapshot:()=>me}:{default:{avatar:'avatar'}}
fixture._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename)
const {CommunityAvatar}=fixture.exports
assert.equal(CommunityAvatar({}).props.src,'data:portrait:anonymous','Guest avatar must not dereference a null profile')
assert.equal(CommunityAvatar({seed:'stable-id',handle:'old_name'}).props.src,CommunityAvatar({seed:'stable-id',handle:'new_name.sz'}).props.src,'Renaming never changes generated identity')
me={avatarSeed:'stable-id',avatarUrl:'/v1/community/media/new'}
let picture=CommunityAvatar({seed:'stable-id',avatarUrl:'/v1/community/media/old'})
assert.equal(picture.props.src,'https://api.test/v1/community/media/new','Own avatar changes override old cached posts immediately')
picture.props.onError();assert.equal(CommunityAvatar({seed:'stable-id'}).props.src,'data:portrait:stable-id','Broken uploaded image falls back to generated avatar')
me={avatarSeed:'stable-id',avatarUrl:null};assert.equal(CommunityAvatar({seed:'stable-id',avatarUrl:'/v1/community/media/old'}).props.src,'data:portrait:stable-id','Removing own avatar overrides old cached posts')
console.log('PASS: guest safety, stable portrait after rename, immediate avatar synchronization, delete and image failure')
