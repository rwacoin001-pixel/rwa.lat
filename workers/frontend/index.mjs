import nextWorker from '../../.open-next/worker.js'
import {proxyPublicPrediction} from '../../lib/prediction-public-proxy'
import {proxyPredictionImage} from '../../lib/prediction-image-delivery'

// Public discovery bypasses the Next runtime entirely, keeping Worker CPU small.
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url)
    if(url.hostname==='www.a-reit.com'){
      url.hostname='a-reit.com'
      return Response.redirect(url.toString(),308)
    }
    const path=url.pathname
    // Static assets are served before the Worker runs; reaching here means the file is not in this build.
    if(path.startsWith('/_next/static/'))return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
    if(request.method==='GET'){
      const matched=/^\/api\/polymarket\/(feed|(?:event|market)\/[^/]+)$/.exec(path)
      if(matched)return proxyPublicPrediction(request,matched[1],env.API_INTERNAL_URL)
      if(path==='/media/prediction'){
        const cache=typeof caches!=='undefined'?caches.default:undefined
        return proxyPredictionImage(request,{cache,waitUntil:ctx?.waitUntil?.bind(ctx)})
      }
    }
    return nextWorker.fetch(request,env,ctx)
  },
}
export {DOQueueHandler,DOShardedTagCache,BucketCachePurge} from '../../.open-next/worker.js'
