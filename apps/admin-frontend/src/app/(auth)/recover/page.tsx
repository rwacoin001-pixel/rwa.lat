'use client'
import { useEffect,useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
type Binding={recoveryToken:string;secret:string;otpauthUri:string}
export default function RecoverPage(){
 const [stage,setStage]=useState<'email'|'code'|'bind'|'done'>('email')
 const [email,setEmail]=useState('');const [code,setCode]=useState('');const [binding,setBinding]=useState<Binding|null>(null)
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [cooldown,setCooldown]=useState(0)
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(c=>Math.max(0,c-1)),1000);return()=>clearTimeout(timer)},[cooldown])
 async function send(action:string,payload:object){
  const r=await fetch(`/api/auth/recovery/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)})
  const data=await r.json();if(!r.ok)throw Error(data.message||'验证失败');return data
 }
 async function request(){setBusy(true);setError('');try{await send('request',{email,locale:navigator.language});setStage('code');setCooldown(60);setCode('')}catch(e){setError(e instanceof Error?e.message:'请求失败')}finally{setBusy(false)}}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(stage==='email'){await request();return}setBusy(true);setError('')
  try{
   if(stage==='code'){setBinding(await send('verify',{email,code}));setCode('');setStage('bind')}
   else if(stage==='bind'&&binding){await send('confirm',{recoveryToken:binding.recoveryToken,code});setBinding(null);setCode('');setStage('done')}
  }catch(e){setError(e instanceof Error?e.message:'验证失败')}finally{setBusy(false)}
 }
 return <main className="flex min-h-screen items-center justify-center px-4 py-12"><section className="w-full max-w-md rounded-3xl border border-ink/[0.08] bg-card p-7 shadow-glass">
  <div className="mb-6 text-center text-xl font-semibold">{stage==='done'?'绑定完成':'恢复验证器'}</div>
  {error&&<p role="alert" className="mb-4 text-sm text-negative">{error}</p>}
  {stage==='done'?<><p className="mb-5 text-sm text-text-faint">原验证器和旧会话已失效。请等待验证器显示下一组动态码后登录。</p><a href="/login" className="block text-center text-sm">返回登录</a></>:<form onSubmit={submit} className="space-y-4">
   {stage==='email'?<div className="space-y-2"><Label htmlFor="recovery-email">管理员邮箱</Label><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div>:null}
   {stage==='code'?<><p className="text-sm text-text-faint">输入邮件中的验证码</p><div className="space-y-2"><Label htmlFor="recovery-code">邮件验证码</Label><Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} disabled={busy}/></div><button type="button" className="text-sm text-text-faint" disabled={busy||cooldown>0} onClick={request}>{cooldown?`${cooldown}s`:'重新发送'}</button></>:null}
   {stage==='bind'&&binding?<><p className="text-sm text-text-faint">用验证器扫描二维码</p><div className="mx-auto w-fit rounded-xl bg-white p-4"><QRCodeSVG value={binding.otpauthUri} size={192}/></div><details className="text-sm"><summary>手动输入密钥</summary><code className="mt-2 block break-all select-all">{binding.secret}</code></details><div className="space-y-2"><Label htmlFor="new-totp">新验证器动态码</Label><Input id="new-totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} disabled={busy}/></div></>:null}
   <Button type="submit" className="w-full" disabled={busy}>{busy?'处理中…':stage==='email'?'发送验证码':stage==='code'?'验证邮箱':'确认绑定'}</Button>
   <a href="/login" className="block text-center text-sm text-text-faint">返回登录</a>
  </form>}
 </section></main>
}
