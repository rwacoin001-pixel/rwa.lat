import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

function worker(fetcher,stored=new Map()){
  const handlers={},writes=[],deleted=[]
  const caches={match:async request=>stored.get(typeof request==='string'?request:request.url),open:async()=>({put:async(key,value)=>{const url=typeof key==='string'?key:key.url;writes.push(url);stored.set(url,value)}}),keys:async()=>['rwa-lat-offline-v11','rwa-lat-offline-v12','other-app-cache'],delete:async key=>deleted.push(key)}
  vm.runInNewContext(readFileSync('public/sw.js','utf8'),{self:{location:{origin:'https://rwa.lat'},addEventListener:(key,fn)=>{handlers[key]=fn},skipWaiting(){},clients:{claim(){}}},caches,fetch:fetcher,URL,Promise})
  return {writes,deleted,async request(path,mode='navigate'){
    const tasks=[];let result
    handlers.fetch({request:{url:'https://rwa.lat'+path,mode,method:'GET'},respondWith:value=>{result=value},waitUntil:task=>tasks.push(task)})
    const response=await result;await Promise.all(tasks);return response
  },async activate(){let task;handlers.activate({waitUntil:value=>task=value});await task}}
}

test('PWA 1102/5xx navigation recovers the last valid shell without caching the error page',async()=>{
  const url='https://rwa.lat/home',stored=new Map([[url,new Response('last-valid-shell')]])
  const sw=worker(async()=>new Response('Error 1102',{status:500}),stored)
  assert.equal(await (await sw.request('/home')).text(),'last-valid-shell');assert.deepEqual(sw.writes,[])
})
test('authentication callbacks and API failures always remain live and never replay cache',async()=>{
  const stored=new Map([['https://rwa.lat/auth/callback/google',new Response('stale-callback')],['https://rwa.lat/v1/auth/session',new Response('stale-session')]])
  const sw=worker(async()=>new Response('live-failure',{status:503}),stored)
  for(const path of ['/auth/callback/google','/v1/auth/session','/api/polymarket/feed'])assert.equal((await sw.request(path)).status,503)
  assert.deepEqual(sw.writes,[])
})
test('manifest loads current start URL instead of replaying an installed legacy manifest',async()=>{
  const url='https://rwa.lat/manifest.webmanifest',stored=new Map([[url,new Response('legacy')]])
  const sw=worker(async()=>new Response('current'),stored)
  assert.equal(await (await sw.request('/manifest.webmanifest','cors')).text(),'current');assert.deepEqual(sw.writes,[url])
})
test('PWA activation deletes only its own old shells and does not touch other caches',async()=>{
  const sw=worker(async()=>new Response('ok'));await sw.activate();assert.deepEqual(sw.deleted,['rwa-lat-offline-v11'])
})
