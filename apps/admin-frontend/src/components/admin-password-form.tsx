'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
export function AdminPasswordForm(){
  const router=useRouter(),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[mfa,setMfa]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const submit=async()=>{
    if(busy)return;if(next!==confirm){setError('两次新密码不一致。');return}setBusy(true);setError('')
    try{const res=await fetch('/api/auth/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({currentPassword:current,newPassword:next,...(mfa?{mfaCode:mfa}:{})})});const data=await res.json();if(!res.ok){setError(data.message??'修改失败');return}setCurrent('');setNext('');setConfirm('');setMfa('');router.push('/login?passwordChanged=1');router.refresh()}catch{setError('后台服务暂时不可用。')}finally{setBusy(false)}
  }
  return <section className="rounded-card border p-5"><h2 className="text-base font-semibold">修改我的管理员密码</h2><p className="mt-2 text-sm text-text-secondary">新密码至少 12 个字符。启用 MFA 时须输入当前验证码；修改后注销全部后台会话，使用新密码重新登录。</p><form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();void submit()}}><fieldset className="space-y-3" disabled={busy}>
    <label className="block">当前密码<Input type="password" autoComplete="current-password" required maxLength={256} value={current} onChange={e=>setCurrent(e.target.value)}/></label>
    <label className="block">新密码<Input type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={next} onChange={e=>setNext(e.target.value)}/></label>
    <label className="block">确认新密码<Input type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
    <label className="block">当前动态验证码（已启用 MFA 时必填）<Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={mfa} onChange={e=>setMfa(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy?'正在修改…':'修改密码并重新登录'}</Button>
  </fieldset></form></section>
}
