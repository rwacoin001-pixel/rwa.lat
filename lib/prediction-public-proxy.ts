// The edge streams compact, public API results; large Gamma payloads stay on the backend.
export async function proxyPublicPrediction(request:Request,path:string,base=process.env.API_INTERNAL_URL||'https://api.rwa.lat') {
  if(!/^(?:feed|(?:event|market)\/\d{1,20})$/.test(path))return Response.json({error:'Invalid prediction parameters'},{status:400})
  const input=new URL(request.url)
  if(input.search.length>2048)return Response.json({error:'Invalid prediction parameters'},{status:400})
  const target=new URL(`/v1/polymarket/public/${path}`,base)
  target.search=input.search
  try {
    const upstream=await fetch(target,{headers:{accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20_000)})
    if(!upstream.ok)return Response.json({error:'Market data unavailable'},{status:upstream.status===400?400:502})
    if(!upstream.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Market data unavailable'},{status:502})
    return new Response(upstream.body,{headers:{'content-type':'application/json','cache-control':upstream.headers.get('cache-control')||'no-store'}})
  }catch{return Response.json({error:'Market data unavailable'},{status:502})}
}
