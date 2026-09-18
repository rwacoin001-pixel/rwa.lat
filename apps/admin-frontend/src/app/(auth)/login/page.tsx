'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nextPath, setNextPath] = useState('/dashboard');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === '1') {
      setNotice('登录会话已过期或已失效，请重新登录。');
    }
    const next = params.get('next');
    if (next && next.startsWith('/')) setNextPath(next);
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
        body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
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
            <svg className="h-7 w-11" viewBox="140 188 226 124" fill="none" aria-hidden="true">
              <path fill="#141830" d="M150 198h51l27.3 53.1-13.1 24.4c-2.8 5.2-7.2 8.1-12.5 8.1-6.1 0-11.4-3.6-14.3-9.2L150 198Z" />
              <path fill="#141830" d="M228.3 251.1l12.4-26.2c2.8-5.9 7.4-9.1 13.1-9.1 6.2 0 10.9 3.5 13.7 9.4L304 302h-51.2l-24.5-50.9Z" />
              <path fill="#5b6cf9" d="M305.4 198H356l-25.9 51.9h-28.2c-5.3 0-9.5-2.2-12.2-6.3-2.8-4.2-3.1-8.9-.8-13.6l16.5-32Z" />
            </svg>
          </span>
          <h1 className="text-xl font-semibold tracking-tight">RWA.LAT Admin</h1>
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
                  placeholder="admin@rwa.lat"
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
              <Label htmlFor="password" className="text-sm font-medium">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="flex items-center gap-1.5 text-sm font-medium">
                <KeyRound className="h-3.5 w-3.5 text-text-faint" />
                动态验证码（如需）
              </Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
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

          <div className="mt-6 border-t border-ink/[0.08] pt-4">
            <p className="text-center text-xs text-muted-foreground">
              RWA.LAT 后台运营管理系统 · 请勿在公共设备上保存登录状态
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
