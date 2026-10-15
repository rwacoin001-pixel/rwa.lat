import { NextRequest,NextResponse } from 'next/server'
import {adminApiBase} from '@/lib/server/admin-session'
import {rejectCrossOrigin} from '@/lib/server/csrf'
export async function POST(request:NextRequest,context:{params:Promise<{action:string}>}){
  const {action}=await context.params
  if(!['request','verify','confirm'].includes(action))return NextResponse.json({message:'Not found'},{status:404})
  const forbidden=rejectCrossOrigin(request)
  if(forbidden)return forbidden
  const payload=await request.json().catch(()=>null)
  if(!payload||typeof payload!=='object')return NextResponse.json({message:'请求无效'},{status:400})
  const body=action==='request'?{email:payload.email,locale:payload.locale}:action==='verify'?{email:payload.email,code:payload.code}:{recoveryToken:payload.recoveryToken,code:payload.code}
  try{
    const r=await fetch(`${adminApiBase()}/admin/auth/recovery/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)})
    const json=await r.json().catch(()=>null)
    if(!r.ok)return NextResponse.json({message:r.status===429?'请求过于频繁，请稍后重试':r.status>=500?'邮件恢复服务暂不可用，请稍后重试':'验证码无效、已过期或已使用'},{status:r.status,headers:{'cache-control':'no-store'}})
    return NextResponse.json(json,{headers:{'cache-control':'no-store'}})
  }catch{return NextResponse.json({message:'恢复服务暂不可用，请稍后重试'},{status:503})}
}
