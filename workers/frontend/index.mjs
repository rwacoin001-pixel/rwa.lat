import nextWorker from '../../.open-next/worker.js'
import {proxyPublicPrediction} from '../../lib/prediction-public-proxy'

// Public discovery bypasses the Next runtime entirely, keeping Worker CPU small.
export default {
  async fetch(request,env,ctx) {
    const path=new URL(request.url).pathname
    if(request.method==='GET'){
      const matched=/^\/api\/polymarket\/(feed|(?:event|market)\/[^/]+)$/.exec(path)
      if(matched)return proxyPublicPrediction(request,matched[1],env.API_INTERNAL_URL)
    }
    return nextWorker.fetch(request,env,ctx)
  },
}
export {DOQueueHandler,DOShardedTagCache,BucketCachePurge} from '../../.open-next/worker.js'
