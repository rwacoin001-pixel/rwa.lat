import type {PredictionBook} from './prediction-quote'
type RawBook={asset_id?:string;timestamp?:string;asks?:Array<{price:string;size:string}>;bids?:Array<{price:string;size:string}>}
export function predictionBookTokens(value:string|null) {
  const tokens=[...new Set((value??'').split(',').filter(Boolean))]
  return !tokens.length||tokens.length>8||tokens.some(token=>!/^\d{1,90}$/.test(token))?null:tokens
}
/** Read-only public CLOB data; no wallet, credentials or order endpoint. */
export async function readPredictionPublicBooks(tokens:readonly string[],fetcher:typeof fetch=fetch) {
  const results:Record<string,PredictionBook|null>={}
  let next=0
  const worker=async()=>{
    while(next<tokens.length){
      const token=tokens[next++]
      try {
        const options={headers:{accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'},next:{revalidate:20},signal:AbortSignal.timeout(6000)}
        const response=await fetcher(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(token)}`,options)
        // An HTTP/network failure is unknown, not proof of an illiquid market.
        if(!response.ok){results[token]=null;continue}
        const book=await response.json() as RawBook
        if(book.asset_id&&book.asset_id!==token){results[token]=null;continue}
        if(!Array.isArray(book.asks)||!Array.isArray(book.bids)){results[token]=null;continue}
        const levels=(values:RawBook['asks'])=>(values??[]).map(level=>({price:Number(level.price),size:Number(level.size)})).filter(level=>Number.isFinite(level.price)&&level.price>0&&level.price<1&&Number.isFinite(level.size)&&level.size>0)
        const stamp=Number(book.timestamp), asOf=new Date(stamp>1e12?stamp:stamp*1000)
        results[token]={asks:levels(book.asks),bids:levels(book.bids),fetchedAt:new Date().toISOString(),...(Number.isFinite(stamp)&&stamp>0&&Number.isFinite(asOf.getTime())?{asOf:asOf.toISOString()}:{})}
      }catch{results[token]=null}
    }
  }
  await Promise.all(Array.from({length:Math.min(4,tokens.length)},worker))
  return results
}
