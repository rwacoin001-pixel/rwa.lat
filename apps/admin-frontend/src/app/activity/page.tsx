'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, LogIn, RefreshCw, UserPlus, Users, UserRound } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/visuals';
import { BarList, MultiLineChart, type SeriesSpec } from '@/components/activity-charts';
import { VisitLog } from '@/components/visit-log';
import { cn } from '@/lib/utils';

interface ActivityDay { day: string; activeUsers: number; anonymousVisitors: number; logins: number; loginUsers: number; registrations: number }
interface ActivitySummary {
  asOf: string;
  timezone: string;
  trackingSince: string | null;
  today: Omit<ActivityDay, 'day'>;
  totals: { users: number; active7: number; active30: number };
  series: ActivityDay[];
  countries: Array<{ country: string; visitors: number; users: number }>;
  devices: Array<{ device: string; visitors: number }>;
}

const RANGES = [7, 30, 90] as const;
const SERIES: SeriesSpec<ActivityDay>[] = [
  { key: 'active', label: '活跃用户', color: '#2a78d6', value: (d) => d.activeUsers },
  { key: 'login', label: '登录人数', color: '#eb6834', value: (d) => d.loginUsers },
  { key: 'reg', label: '新注册', color: '#1baf7a', value: (d) => d.registrations },
];
const DEVICE_LABELS: Record<string, string> = { mobile: '手机', desktop: '电脑', tablet: '平板', other: '其他' };

function countryName(code: string, names: Intl.DisplayNames | null) {
  if (code === 'OTHER') return '其他地区';
  if (code === '??' || code === 'XX') return '未知';
  if (code === 'T1') return 'Tor 网络';
  try { return names?.of(code) ?? code; } catch { return code; }
}

export default function ActivityPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const names = useMemo(() => { try { return new Intl.DisplayNames(['zh-CN'], { type: 'region' }); } catch { return null; } }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/console/activity?days=${days}`, { credentials: 'include', cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `加载失败 (HTTP ${res.status})`);
      setData(body as ActivitySummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const rangeStart = data?.series[0]?.day ?? null;
  const partial = data?.trackingSince && rangeStart && data.trackingSince > rangeStart;
  const visitorsTotal = data?.countries.reduce((sum, row) => sum + row.visitors, 0) ?? 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data ? `截至 ${new Date(data.asOf).toLocaleString('zh-CN', { hour12: false })} · 按北京时间统计` : ' '}
          </p>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="统计区间" className="flex rounded-full border border-ink/[0.1] bg-white/60 p-0.5">
              {RANGES.map((value) => (
                <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}
                  className={cn('h-8 rounded-full px-3.5 text-sm transition-colors', days === value ? 'bg-ink text-white' : 'text-text-secondary hover:text-ink')}>
                  {value} 天
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="flex items-center gap-2"><RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />刷新</Button>
          </div>
        </div>

        {error && <Card className="glass-strong border-amber-500/40"><CardContent className="p-4 text-sm text-amber-700">活跃数据加载失败：{error}</CardContent></Card>}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="今日活跃用户" value={data.today.activeUsers} sub={`近 7 日 ${data.totals.active7} · 近 30 日 ${data.totals.active30}`} icon={Users} tone="mint" spark={data.series.map((d) => d.activeUsers)} />
              <StatCard label="今日登录" value={data.today.loginUsers} sub={`${data.today.logins} 次登录`} icon={LogIn} tone="amber" spark={data.series.map((d) => d.loginUsers)} />
              <StatCard label="今日新注册" value={data.today.registrations} sub={`累计用户 ${data.totals.users}`} icon={UserPlus} tone="emerald" spark={data.series.map((d) => d.registrations)} />
              <StatCard label="今日匿名访客" value={data.today.anonymousVisitors} sub="未登录访问（按日去重）" icon={UserRound} tone="slate" spark={data.series.map((d) => d.anonymousVisitors)} />
            </div>

            {partial && (
              <p className="flex items-start gap-2 text-sm text-text-secondary">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
                <span>活跃用户、访客、地区和设备从 {data.trackingSince} 开始采集，之前的日期为 0；登录和注册是完整历史。</span>
              </p>
            )}

            <Card className="glass-strong">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>每日用户走势</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowTable((value) => !value)}>{showTable ? '看图表' : '看数据表'}</Button>
              </CardHeader>
              <CardContent>
                {showTable ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-muted-foreground border-b border-ink/[0.08]">
                        <th className="py-2 pr-3 font-medium">日期</th><th className="py-2 pr-3 font-medium text-right">活跃用户</th><th className="py-2 pr-3 font-medium text-right">登录人数</th>
                        <th className="py-2 pr-3 font-medium text-right">登录次数</th><th className="py-2 pr-3 font-medium text-right">新注册</th><th className="py-2 font-medium text-right">匿名访客</th>
                      </tr></thead>
                      <tbody>
                        {[...data.series].reverse().map((d) => (
                          <tr key={d.day} className="border-b border-ink/[0.05] tabular-nums">
                            <td className="py-1.5 pr-3">{d.day}</td><td className="py-1.5 pr-3 text-right">{d.activeUsers}</td><td className="py-1.5 pr-3 text-right">{d.loginUsers}</td>
                            <td className="py-1.5 pr-3 text-right">{d.logins}</td><td className="py-1.5 pr-3 text-right">{d.registrations}</td><td className="py-1.5 text-right">{d.anonymousVisitors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <MultiLineChart rows={data.series} series={SERIES} label="每日活跃用户、登录人数与新注册" />}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="glass-strong lg:col-span-2">
                <CardHeader><CardTitle>国家 / 地区（{days} 天访客）</CardTitle></CardHeader>
                <CardContent>
                  <BarList rows={data.countries.map((row) => ({
                    key: row.country,
                    label: countryName(row.country, names),
                    value: row.visitors,
                    sub: `${visitorsTotal ? Math.round((row.visitors / visitorsTotal) * 100) : 0}% · ${row.users} 位用户`,
                  }))} />
                </CardContent>
              </Card>
              <Card className="glass-strong">
                <CardHeader><CardTitle>设备（{days} 天访客）</CardTitle></CardHeader>
                <CardContent>
                  <BarList rows={data.devices.map((row) => ({ key: row.device, label: DEVICE_LABELS[row.device] ?? row.device, value: row.visitors }))} />
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground">上方统计按日去重：已登录用户按账号计，未登录访客按当日加密后的 IP 计。地区来自 Cloudflare。</p>
          </>
        )}

        <VisitLog countryName={(code) => countryName(code, names)} />
        <p className="text-xs text-muted-foreground">访客记录含原始 IP 与浏览器信息，属于个人数据：仅有“查看用户”权限的管理员可见，保存 180 天后自动删除。</p>
      </div>
    </AdminLayout>
  );
}
