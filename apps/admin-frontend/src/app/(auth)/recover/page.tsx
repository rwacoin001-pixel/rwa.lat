'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AuthField, AuthFrame, AuthMessage, AuthSubmit } from '@/components/ops/AuthFrame'

type Binding = { recoveryToken: string; secret: string; otpauthUri: string }
const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6)
const CODE_CLASS = 'text-center font-mono text-[20px] tracking-[0.5em]'

export default function RecoverPage() {
  const [stage, setStage] = useState<'email' | 'code' | 'bind' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [binding, setBinding] = useState<Binding | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => { if (!cooldown) return; const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000); return () => clearTimeout(t) }, [cooldown])

  async function send(action: string, payload: object) {
    const r = await fetch(`/api/auth/recovery/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) })
    const data = await r.json()
    if (!r.ok) throw Error(data.message || '验证失败')
    return data
  }
  async function request() {
    setBusy(true); setError('')
    try { await send('request', { email, locale: navigator.language }); setStage('code'); setCooldown(60); setCode('') }
    catch (e) { setError(e instanceof Error ? e.message : '请求失败') }
    finally { setBusy(false) }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (stage === 'email') { await request(); return }
    setBusy(true); setError('')
    try {
      if (stage === 'code') { setBinding(await send('verify', { email, code })); setCode(''); setStage('bind') }
      else if (stage === 'bind' && binding) { await send('confirm', { recoveryToken: binding.recoveryToken, code }); setBinding(null); setCode(''); setStage('done') }
    } catch (e) { setError(e instanceof Error ? e.message : '验证失败') }
    finally { setBusy(false) }
  }

  const intro = stage === 'email' ? '我们会给管理员邮箱发一个验证码。' : stage === 'code' ? `验证码已发到 ${email}。` : stage === 'bind' ? '用验证器扫描二维码，再输入它显示的动态码。' : '原验证器和旧的登录都已失效。'
  return (
    <AuthFrame title={stage === 'done' ? '绑定完成' : '恢复验证器'} intro={intro} footer={<a href="/login" className="hover:text-ops-text">返回登录</a>}>
      {error && <AuthMessage kind="error">{error}</AuthMessage>}
      {stage === 'done' ? (
        <div className="space-y-5">
          <p className="text-[14px] leading-relaxed text-ops-muted">等验证器显示下一组动态码，再去登录。</p>
          <a href="/login" className="flex h-12 w-full items-center justify-center rounded-full bg-ops-lime text-[15px] font-medium text-ops-ink">去登录</a>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {stage === 'email' && <AuthField label="管理员邮箱" id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />}
          {stage === 'code' && (
            <AuthField label="邮件验证码" id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="••••••"
              value={code} onChange={(e) => setCode(digits(e.target.value))} disabled={busy} className={CODE_CLASS}
              hint={<button type="button" className="hover:text-ops-text disabled:opacity-60" disabled={busy || cooldown > 0} onClick={request}>{cooldown ? `${cooldown} 秒后可重新发送` : '重新发送'}</button>} />
          )}
          {stage === 'bind' && binding && (
            <>
              <div className="mx-auto w-fit rounded-[20px] bg-white p-4"><QRCodeSVG value={binding.otpauthUri} size={184} /></div>
              <details className="text-[13px] text-ops-muted">
                <summary className="cursor-pointer hover:text-ops-text">手动输入密钥</summary>
                <code className="mt-2 block select-all break-all rounded-[14px] bg-ops-bg px-4 py-3 font-mono text-[13px] text-ops-text">{binding.secret}</code>
              </details>
              <AuthField label="新验证器的动态码" id="new-totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="••••••"
                value={code} onChange={(e) => setCode(digits(e.target.value))} disabled={busy} className={CODE_CLASS} />
            </>
          )}
          <AuthSubmit busy={busy}>{busy ? '处理中…' : stage === 'email' ? '发送验证码' : stage === 'code' ? '验证邮箱' : '确认绑定'}</AuthSubmit>
        </form>
      )}
    </AuthFrame>
  )
}
