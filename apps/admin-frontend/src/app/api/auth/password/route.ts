import {NextRequest,NextResponse} from 'next/server'
import {ADMIN_SESSION_COOKIE,adminApiBase,adminSessionCookieOptions} from '@/lib/server/admin-session'
import {rejectCrossOrigin} from '@/lib/server/csrf'
export async function POST(request:NextRequest){
  const forbidden=rejectCrossOrigin(request)
  if(forbidden)return forbidden
  const token=request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if(!token)return NextResponse.json({message:'请先登录后台。'},{status:401})
  const body=await request.json().catch(()=>null)
  if(!body||typeof body.currentPassword!=='string'||typeof body.newPassword!=='string'||body.newPassword.length<12||body.newPassword.length>256)return NextResponse.json({message:'新密码须为 12–256 个字符。'},{status:400})
  try{
    const upstream=await fetch(`${adminApiBase()}/admin/auth/password`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({currentPassword:body.currentPassword,newPassword:body.newPassword,...(typeof body.mfaCode==='string'?{mfaCode:body.mfaCode}:{})}),cache:'no-store'})
    const data=await upstream.json().catch(()=>({}))
    if(!upstream.ok){const mfa=data.message==='Additional administrator verification is required';return NextResponse.json({message:upstream.status>=500?'后台服务暂时不可用。':mfa?'请核对当前动态验证码及 MFA 配置。':'当前密码未通过校验或账户不可用，请勿连续重复尝试。'},{status:upstream.status})}
    const result=NextResponse.json({status:'password_changed'})
    result.cookies.set(ADMIN_SESSION_COOKIE,'',adminSessionCookieOptions(0))
    return result
  }catch{return NextResponse.json({message:'后台服务暂时不可用。'},{status:503})}
}
