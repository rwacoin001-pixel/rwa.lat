import { NextRequest,NextResponse } from 'next/server'
const base=(process.env.ADMIN_API_URL??'http://localhost:4100/v1').replace(/\/$/,'')
export async function POST(request:NextRequest,context:{params:Promise<{action:string}>}){
  const {action}=await context.params
  if(!['request','verify','confirm'].includes(action))return NextResponse.json({message:'Not found'},{status:404})
  const origin=request.headers.get('origin')
  const allowedOrigin=process.env.PUBLIC_ADMIN_FRONTEND_ORIGIN??request.nextUrl.origin
  if(origin&&origin!==allowedOrigin)return NextResponse.json({message:'Invalid request origin'},{status:403})
  const payload=await request.json().catch(()=>null)
  if(!payload||typeof payload!=='object')return NextResponse.json({message:'请求无效'},{status:400})
  const body=action==='request'?{email:payload.email}:action==='verify'?{email:payload.email,code:payload.code}:{recoveryToken:payload.recoveryToken,code:payload.code}
  try{
    const r=await fetch(`${base}/admin/auth/recovery/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)})
    const json=await r.json().catch(()=>null)
    if(!r.ok)return NextResponse.json({message:r.status===429?'请求过于频繁，请稍后重试':r.status>=500?'邮件恢复服务暂不可用，请稍后重试':'验证码无效、已过期或已使用'},{status:r.status,headers:{'cache-control':'no-store'}})
    return NextResponse.json(json,{headers:{'cache-control':'no-store'}})
  }catch{return NextResponse.json({message:'恢复服务暂不可用，请稍后重试'},{status:503})}
}
