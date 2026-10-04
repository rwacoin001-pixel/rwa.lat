import {predictionQuote, type PredictionBook} from './prediction-quote'

export type PredictionAvailabilityMarket = {id:string; prices:number[]; tokenIds?:string[]; closed?:boolean; acceptingOrders?:boolean}
export type PredictionDirectionAvailability = {
  state:'available'|'unavailable'|'unknown'
  reason:'closed'|'paused'|'empty_book'|'thin_book'|'invalid_price'|'price_deviation'|'expired'|'unavailable'|null
  price:number|null
  depth:number
}
/** Public screening: small depth is informational, never a new minimum bet size. */
export function evaluatePredictionDirections(market:PredictionAvailabilityMarket, books:readonly (PredictionBook|null|undefined)[] = [], now=Date.now(), baselineAmount=1):[PredictionDirectionAvailability,PredictionDirectionAvailability] {
  const minimum=Number.isFinite(baselineAmount)&&baselineAmount>0?baselineAmount:1
  return [0,1].map(side=>{
    if(market.closed||market.acceptingOrders===false)return {state:'unavailable',reason:market.closed?'closed':'paused',price:null,depth:0}
    const book=books[side]
    // A missing response and a stale response are not proof of an illiquid market.
    if(!book)return {state:'unknown',reason:'unavailable',price:null,depth:0}
    const age=now-Date.parse(book.fetchedAt)
    if(!Number.isFinite(age)||age < -5000 || age>120000)return {state:'unknown',reason:'expired',price:null,depth:0}
    const quote=predictionQuote(book,market.prices[side],minimum,now)
    if(quote.available)return {state:'available',reason:null,price:quote.price,depth:quote.depth}
    const reason=quote.reason==='no_liquidity'?(quote.depth>0?'thin_book':'empty_book'):quote.reason
    if(reason==='thin_book')return {state:'available',reason,price:quote.price,depth:quote.depth}
    return {state:'unavailable',reason,price:quote.price,depth:quote.depth}
  }) as [PredictionDirectionAvailability,PredictionDirectionAvailability]
}
export function hideUnavailablePrediction(directions:readonly PredictionDirectionAvailability[]) {
  return directions.length===2&&directions.every(direction=>direction.state==='unavailable')
}
export function predictionCountdown(endAt:string|null|undefined, now=Date.now()) {
  const end=Date.parse(endAt??'')
  if(!Number.isFinite(end))return null
  const total=Math.max(0,Math.ceil((end-now)/1000))
  return {reached:total===0,days:Math.floor(total/86400),hours:Math.floor(total%86400/3600),minutes:Math.floor(total%3600/60),seconds:total%60}
}
