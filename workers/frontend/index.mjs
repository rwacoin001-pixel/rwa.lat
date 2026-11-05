import nextWorker from '../../.open-next/worker.js'
import {proxyPublicPrediction} from '../../lib/prediction-public-proxy'
import {proxyPredictionImage} from '../../lib/prediction-image-delivery'
import {withClientHeaders} from '../../lib/edge-client-headers.mjs'
import {isPublicRead,servePublicRead} from '../../lib/edge-public-cache.mjs'
import {brandRequestGate,securePreviewResponse} from '../../lib/brand/preview-gate.mjs'

// Public discovery bypasses the Next runtime entirely, keeping Worker CPU small.
export default {
  async fetch(request,env,ctx) {
    const gate=await brandRequestGate(request,env)
    if(gate.response)return gate.preview ? securePreviewResponse(gate.response) : gate.response
    request=gate.request
    const result=await handleRequest(request,env,ctx,gate)
    return gate.preview ? securePreviewResponse(result) : result
  },
}

async function handleRequest(request,env,ctx,gate) {
    if(gate.asset)return env.ASSETS.fetch(request)
    if(gate.preview && ['GET','HEAD'].includes(request.method)) {
      const asset=await env.ASSETS.fetch(request)
      if(asset.status!==404)return asset
    }
    const url=new URL(request.url)
    if(url.hostname==='www.a-reit.com'){
      url.hostname='a-reit.com'
      return Response.redirect(url.toString(),308)
    }
    const path=url.pathname
    // Static assets are served before the Worker runs; reaching here means the file is not in this build.
    if(path.startsWith('/_next/static/'))return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
    // Local-only preview pages: their code already calls notFound() in production, but that renders a 200 page. Answer 404 for real.
    if(path==='/design-preview'||path==='/dev'||path.startsWith('/dev/'))return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
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
      const forward=async()=>nextWorker.fetch(await withClientHeaders(request,env.EDGE_CLIENT_SIGNING_SECRET),env,ctx)
      if(isPublicRead(request.method,path))return servePublicRead(request,{cache:typeof caches!=='undefined'?caches.default:undefined,waitUntil:ctx?.waitUntil?.bind(ctx),forward})
      return forward()
    }
    return nextWorker.fetch(request,env,ctx)
}

export {DOQueueHandler,DOShardedTagCache,BucketCachePurge} from '../../.open-next/worker.js'
