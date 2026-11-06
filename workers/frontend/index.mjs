import nextWorker from '../../.open-next/worker.js'
import {proxyPublicPrediction} from '../../lib/prediction-public-proxy'
import {proxyPredictionImage} from '../../lib/prediction-image-delivery'
import {withClientHeaders} from '../../lib/edge-client-headers.mjs'
import {isPublicRead,servePublicRead} from '../../lib/edge-public-cache.mjs'
import {brandRequestGate,securePreviewResponse} from '../../lib/brand/preview-gate.mjs'
import {kimengOAuthReturn} from '../../lib/brand/oauth-return.mjs'
import {kimengPhoneRedirect} from '../../lib/brand/phone-access.mjs'

// Public discovery bypasses the Next runtime entirely, keeping Worker CPU small.
export default {
  async fetch(request,env,ctx) {
    const gate=await brandRequestGate(request,env)
    if(gate.response)return gate.preview ? securePreviewResponse(gate.response) : gate.response
    request=gate.request
    const result=await handleRequest(request,env,ctx,gate)
    if (gate.preview) return securePreviewResponse(result)
    if (!gate.kimeng) return result
    const headers = new Headers(result.headers)
    headers.set('strict-transport-security', 'max-age=31536000')
    headers.set('x-content-type-options', 'nosniff')
    headers.set('x-frame-options', 'DENY')
    if (/^\/(?:auth\/|verify-email(?:\/|$)|recovery(?:\/|$))/.test(new URL(request.url).pathname)) {
      headers.set('referrer-policy', 'no-referrer')
      headers.set('cache-control', 'no-store')
    }
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers })
  },
}

async function handleRequest(request,env,ctx,gate) {
    if(gate.asset)return env.ASSETS.fetch(request)
    const path=new URL(request.url).pathname
    if((gate.preview || (gate.kimeng && !path.startsWith('/v1/'))) && ['GET','HEAD'].includes(request.method)) {
      const asset=await env.ASSETS.fetch(request)
      if(asset.status!==404)return asset
    }
    const url=new URL(request.url)
    if(url.hostname==='www.a-reit.com'){
      url.hostname='a-reit.com'
      return Response.redirect(url.toString(),308)
    }
    if(url.origin==='https://a-reit.com' && request.method==='GET'){
      // WebAuthn related origins retain the existing RP ID, so A-REIT credentials remain usable.
      if(path==='/.well-known/webauthn')return Response.json({origins:['https://kimengresearch.com']},{headers:{'cache-control':'public, max-age=300','x-content-type-options':'nosniff'}})
      const relay=await kimengOAuthReturn(url,env.API_INTERNAL_URL,async(target,init)=>{
        // Use the production API rewrite for this internal check too. No user headers or
        // OAuth code go to the lookup; the destination path is fixed by the relay.
        const lookup=new Request(new URL(target.pathname,url.origin),{method:'POST',headers:init.headers,body:init.body})
        return nextWorker.fetch(lookup,env,ctx)
      })
      if(relay)return relay
    }
    // Static assets are served before the Worker runs; reaching here means the file is not in this build.
    if(path.startsWith('/_next/static/'))return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
    // Local-only preview pages: their code already calls notFound() in production, but that renders a 200 page. Answer 404 for real.
    if(path==='/design-preview'||path==='/dev'||path.startsWith('/dev/'))return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
    if (gate.kimeng) {
      const phoneRedirect = kimengPhoneRedirect(request)
      if (phoneRedirect) return phoneRedirect
    }
    if(request.method==='GET'){
      const matched=/^\/api\/polymarket\/(feed|(?:event|market)\/[^/]+)$/.exec(path)
      if(matched)return proxyPublicPrediction(request,matched[1],env.API_INTERNAL_URL)
      if(path==='/media/prediction'){
        const cache=typeof caches!=='undefined'?caches.default:undefined
        return proxyPredictionImage(request,{cache,waitUntil:ctx?.waitUntil?.bind(ctx)})
      }
    }
    // /v1 is proxied to the API from this Worker, so the API would otherwise see the Worker as the visitor.
    if(path.startsWith('/v1/')){
      const forward=async()=>{
        const signed=await withClientHeaders(request,env.EDGE_CLIENT_SIGNING_SECRET,Date.now(),gate.kimeng?'kimeng':undefined)
        if(!gate.kimeng)return nextWorker.fetch(signed,env,ctx)
        if(!signed.headers.has('x-client-sig'))return new Response('API temporarily unavailable',{status:503,headers:{'cache-control':'no-store'}})
        // The API is a fixed origin. Never follow an upstream redirect with account headers.
        const upstream=new URL(path+url.search,'https://api.a-reit.com')
        const headers=new Headers(signed.headers)
        for(const key of ['host','forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto'])headers.delete(key)
        const response=await fetch(new Request(upstream,signed),{headers,redirect:'manual'})
        if(response.status>=300&&response.status<400&&response.status!==304)return new Response('Unexpected API redirect',{status:502,headers:{'cache-control':'no-store'}})
        if(isPublicRead(request.method,path))return response
        const privateHeaders=new Headers(response.headers)
        privateHeaders.set('cache-control','private, no-store')
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers:privateHeaders})
      }
      if(isPublicRead(request.method,path))return servePublicRead(request,{cache:typeof caches!=='undefined'?caches.default:undefined,waitUntil:ctx?.waitUntil?.bind(ctx),forward})
      return forward()
    }
    return nextWorker.fetch(request,env,ctx)
}

export {DOQueueHandler,DOShardedTagCache,BucketCachePurge} from '../../.open-next/worker.js'
