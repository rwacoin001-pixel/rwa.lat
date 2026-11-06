import { NextRequest, NextResponse } from 'next/server'
import { isAppLocale, LANGUAGE_COOKIE } from '@/lib/locale-detection'
export async function GET(req:NextRequest,{params}:{params:Promise<{code:string}>}) {
  const {code}=await params
  if (!/^[a-zA-Z0-9]{6,16}$/.test(code)) return NextResponse.json({message:'Invalid invitation code'},{status:400})
  const base=(process.env.API_INTERNAL_URL||'https://api.a-reit.com').replace(/\/$/,'')
  const old=req.cookies.get('rwa_referral')?.value
  try {
    const upstream=await fetch(`${base}/r/${encodeURIComponent(code)}`,{headers:old?{cookie:`rwa_referral=${encodeURIComponent(old)}`}:{},cache:'no-store',signal:AbortSignal.timeout(20000)})
    if(!upstream.ok) return NextResponse.json({message:'Invitation link is unavailable'},{status:upstream.status,headers:{'Cache-Control':'no-store'}})
    const data=await upstream.json() as {attributionToken:string;expiresAt:string}
    // Where the link should land (2026-10-28): a shared post or profile (`?next=`, same-site paths only), else the invitation page.
    const next=req.nextUrl.searchParams.get('next')
    const sameSite=Boolean(next)&&next!.startsWith('/')&&!next!.startsWith('//')&&!next!.includes('\\')&&!/\s/.test(next!)
    const target=new URL(sameSite?next!:'/invite',req.url)
    const lang=req.nextUrl.searchParams.get('lang')
    if(isAppLocale(lang)) target.searchParams.set('lang',lang)
    const response=NextResponse.redirect(target,303)
    response.headers.set('Cache-Control','no-store')
    response.cookies.set('rwa_referral',data.attributionToken,{httpOnly:true,secure:req.nextUrl.protocol==='https:',sameSite:'lax',path:'/',expires:new Date(data.expiresAt)})
    // An explicit invitation language wins over an older recipient preference.
    if(isAppLocale(lang)) response.cookies.set(LANGUAGE_COOKIE,lang,{secure:req.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:31536000})
    return response
  } catch {return NextResponse.json({message:'Invitation service is temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
