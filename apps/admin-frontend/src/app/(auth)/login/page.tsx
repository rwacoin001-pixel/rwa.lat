'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthField, AuthFrame, AuthMessage, AuthSubmit } from '@/components/ops/AuthFrame'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [nextPath, setNextPath] = useState('/today')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('passwordChanged') === '1') setNotice('请用验证器上当前的动态码重新登录。')
    if (params.get('expired') === '1') setNotice('登录已过期，请重新登录。')
    const next = params.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) setNextPath(next)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mfaCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || '登录失败')
      router.push(nextPath)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame title="登录" intro="管理员邮箱加验证器上的 6 位动态码。"
      footer={<>请勿在公共设备上保持登录。</>}>
      {error ? <AuthMessage kind="error">{error}</AuthMessage> : notice ? <AuthMessage kind="info">{notice}</AuthMessage> : null}
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="邮箱" id="email" type="email" placeholder="admin@a-reit.com" value={email}
          onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={loading} />
        <AuthField label="动态码" id="mfa-code" type="text" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6}
          placeholder="••••••" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoComplete="one-time-code" disabled={loading} className="text-center font-mono text-[20px] tracking-[0.5em]"
          hint={<a href="/recover" className="underline-offset-4 hover:text-ops-text hover:underline">验证器用不了？</a>} />
        <div className="pt-1"><AuthSubmit busy={loading}>{loading ? '登录中…' : '登录'}</AuthSubmit></div>
      </form>
    </AuthFrame>
  )
}
