import {NextResponse} from 'next/server'
export const revalidate=8
export async function GET(_request:Request,{params}:{params:Promise<{conditionId:string}>}) {
  const {conditionId}=await params
  if(!/^0x[\da-f]{64}$/i.test(conditionId))return NextResponse.json({error:'Invalid market'},{status:400})
  try {
    const response=await fetch(`https://data-api.polymarket.com/trades?market=${conditionId}&limit=12&side=BUY`,{next:{revalidate},signal:AbortSignal.timeout(8000)})
    if(!response.ok)throw new Error()
    const raw:unknown=await response.json()
    if(!Array.isArray(raw))throw new Error()
    const seen=new Set<string>()
    const items=raw.flatMap(t=>{
      const amount=Number(t.price)*Number(t.size),side=Number(t.outcomeIndex),timestamp=Number(t.timestamp)
      const id=`${t.transactionHash}:${side}:${t.size}:${t.price}`
      if(t.conditionId!==conditionId||t.side!=='BUY'||![0,1].includes(side)||!Number.isFinite(amount)||amount<=0||!Number.isFinite(timestamp)||timestamp<=0||Number(t.price)<=0||Number(t.price)>1||seen.has(id))return []
      seen.add(id)
      return [{id,side,amount,timestamp}]
    }).sort((a,b)=>b.timestamp-a.timestamp)
    return NextResponse.json({items})
  }catch{return NextResponse.json({error:'Trades unavailable'},{status:502})}
}
