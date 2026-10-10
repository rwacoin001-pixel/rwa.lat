// The edge streams compact, public API results; large Gamma payloads stay on the backend.
export async function proxyPublicPrediction(request:Request,path:string,base=process.env.API_INTERNAL_URL||'https://api.a-reit.com') {
  if(!/^(?:feed|(?:event|market)\/\d{1,20})$/.test(path))return Response.json({error:'Invalid prediction parameters'},{status:400})
  const input=new URL(request.url)
  if(input.search.length>2048)return Response.json({error:'Invalid prediction parameters'},{status:400})
  const target=new URL(`/v1/polymarket/public/${path}`,base)
  target.search=input.search
  try {
    // Workers support manual redirects; do not follow a provider redirect.
    const upstream=await fetch(target,{headers:{accept:'application/json'},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(20_000)})
    if(!upstream.ok){console.warn('prediction_public_upstream_status',upstream.status);return Response.json({error:'Market data unavailable'},{status:upstream.status===400?400:502})}
    if(!upstream.headers.get('content-type')?.includes('application/json')){console.warn('prediction_public_upstream_content_type');return Response.json({error:'Market data unavailable'},{status:502})}
    return new Response(upstream.body,{headers:{'content-type':'application/json','cache-control':upstream.headers.get('cache-control')||'no-store'}})
  }catch(error){console.warn('prediction_public_proxy_error',error instanceof Error?error.name+': '+error.message.replace(/https?:\/\/\S+/g,'[upstream]').slice(0,160):'Unknown error');return Response.json({error:'Market data unavailable'},{status:502})}
}
