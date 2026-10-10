'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nextPath, setNextPath] = useState('/dashboard');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('passwordChanged') === '1') setNotice('请使用当前动态验证码重新登录。');
    if (params.get('expired') === '1') {
      setNotice('登录会话已过期或已失效，请重新登录。');
    }
    const next = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) setNextPath(next);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, mfaCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '登录失败');
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="animate-in w-full max-w-md">
        {/* Brand */}
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-white shadow-glass ring-1 ring-ink/[0.06]">
            <svg className="h-7 w-11" viewBox="0 0 500 280" fill="none" aria-hidden="true"><g transform="translate(126 0)"><path fill="#141830" d="M4 78Q4 69 13 65L139 8Q146 5 153 8L213 37Q222 42 222 53V144L154 113V71L77 106V199Q77 207 70 211L16 242Q4 248 4 235Z" /><path fill="#19C7AA" d="M113 95L238 152Q247 156 247 167V258Q247 270 236 265L121 213Q113 210 113 199Z" /></g></svg>
          </span>
          <h1 className="text-xl font-semibold tracking-tight">A-REIT Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">运营后台管理系统</p>
        </div>

        {/* Card */}
        <div className="glass-strong animate-in rounded-[28px] p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint/12 text-mint">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold">欢迎回来</p>
              <p className="text-xs text-muted-foreground">请使用管理员账号登录</p>
            </div>
          </div>

          {notice && !error && (
            <div
              className="mb-5 flex items-center gap-2 rounded-2xl border border-mint/25 bg-mint/10 p-3 text-sm text-mint"
              role="status"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div
              className="mb-5 flex items-center gap-2 rounded-2xl border border-negative/25 bg-negative/10 p-3 text-sm text-negative"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                邮箱地址
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@a-reit.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

<div className="space-y-2">
              <Label htmlFor="mfa-code" className="flex items-center gap-1.5 text-sm font-medium">
                <KeyRound className="h-3.5 w-3.5 text-text-faint" />
                动态验证码
              </Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
                maxLength={6}
                placeholder="6 位 Authenticator 验证码"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                disabled={loading}
                className="tracking-[0.3em]"
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>
          <a href="/recover" className="mt-4 block text-center text-sm text-text-faint hover:text-ink">无法使用验证器？</a>

          <div className="mt-6 border-t border-ink/[0.08] pt-4">
            <p className="text-center text-xs text-muted-foreground">
              A-REIT 后台运营管理系统 · 请勿在公共设备上保存登录状态
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
