'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-in">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex items-center gap-2 text-xl font-semibold" aria-label="RWA.LAT Admin">
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
              <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="16" r="3" fill="#2FE6BF" />
            </svg>
            <span className="font-semibold tracking-tight">RWA.LAT Admin</span>
          </Link>
          <p className="text-muted-foreground mt-2">后台运营管理系统</p>
        </div>

        <div className="glass-strong rounded-xl p-6 sm:p-8 animate-in">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold">欢迎回来</h1>
            <p className="text-muted-foreground mt-1">请使用管理员账号登录</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm flex items-center gap-2" role="alert">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>登录失败，请重试</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                邮箱地址
              </Label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
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
              <Label htmlFor="mfa-code" className="text-sm font-medium">
                Authenticator code (if required)
              </Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                密码
              </Label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2H7" />
                </svg>
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

            <Button
              type="submit"
              className="w-full py-3 text-base font-medium"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-sm text-muted-foreground text-center">
              RWA.LAT 后台运营管理系统 v0.1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
