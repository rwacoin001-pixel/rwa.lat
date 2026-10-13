'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Clock, Flame, RefreshCw, Wallet } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/visuals';
import { BalanceChart, FlowsChart, FundsTable, type FundsDay } from '@/components/funds-charts';
import { formatAtomic } from '@/lib/money';
import { addressExplorerUrl } from '@/lib/chains';
import { cn } from '@/lib/utils';

type Amount = { count: number; atomic: string };
interface FundsSummary {
  asOf: string;
  timezone: string;
  balances: { cashAtomic: string; availableAtomic: string; lockedAtomic: string; pendingAtomic: string; investedAtomic: string; rewardPayableAtomic: string; fundedUsers: number };
  today: { deposits: Amount; withdrawals: Amount & { feeAtomic: string }; withdrawalRequests: Amount };
  allTime: { deposits: Amount; withdrawals: Amount };
  pending: { review: Amount; inFlight: Amount; deposits: Amount; manualReview: Amount };
  hotWallet: { address: string | null; usdtAtomic: string | null; trxSun: string | null; checkedAt: string | null; error: string | null };
  pool: { available: number; current: number; retired: number };
  series: FundsDay[];
}

const RANGES = [7, 30, 90] as const;
// A TRC-20 transfer without staked energy burns up to ~30 TRX; keep a buffer for a few.
const TRX_LOW_SUN = BigInt(100_000_000);
const POOL_LOW = 20;

const usd = (atomic: string | null | undefined) => (atomic == null ? '—' : formatAtomic(atomic, 6, { group: true }));
const trx = (sun: string | null) => (sun == null ? '—' : formatAtomic(sun, 6, { group: true }));

function Notice({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <p className={cn('flex items-start gap-2 text-sm', tone === 'ok' ? 'text-text-secondary' : 'text-amber-700')}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'ok' ? 'text-emerald-600' : 'text-amber-600')} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export default function FundsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<FundsSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/console/funds?days=${days}`, { credentials: 'include', cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `加载失败 (HTTP ${res.status})`);
      setData(body as FundsSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const owed = data ? BigInt(data.pending.review.atomic) + BigInt(data.pending.inFlight.atomic) : BigInt(0);
  const hotUsdt = data?.hotWallet.usdtAtomic != null ? BigInt(data.hotWallet.usdtAtomic) : null;
  const hotTrx = data?.hotWallet.trxSun != null ? BigInt(data.hotWallet.trxSun) : null;
  const explorer = data?.hotWallet.address ? addressExplorerUrl('tron', data.hotWallet.address) : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data ? `截至 ${new Date(data.asOf).toLocaleString('zh-CN', { hour12: false })} · 按北京时间统计` : ' '}
          </p>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="统计区间" className="flex rounded-full border border-ink/[0.1] bg-white/60 p-0.5">
              {RANGES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={days === value}
                  onClick={() => setDays(value)}
                  className={cn('h-8 rounded-full px-3.5 text-sm transition-colors', days === value ? 'bg-ink text-white' : 'text-text-secondary hover:text-ink')}
                >
                  {value} 天
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="flex items-center gap-2"><RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />刷新</Button>
          </div>
        </div>

        {error && (
          <Card className="glass-strong border-amber-500/40"><CardContent className="p-4 text-sm text-amber-700">资金数据加载失败：{error}</CardContent></Card>
        )}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="用户总余额 (USDT)"
                value={usd(data.balances.cashAtomic)}
                sub={`可用 ${usd(data.balances.availableAtomic)} · 冻结 ${usd(data.balances.lockedAtomic)} · ${data.balances.fundedUsers} 位用户`}
                icon={Wallet}
                tone="mint"
                spark={data.series.map((d) => Number(d.cashBalanceAtomic) / 1e6)}
              />
              <StatCard
                label="今日充值"
                value={usd(data.today.deposits.atomic)}
                sub={`${data.today.deposits.count} 笔入账 · 待确认 ${data.pending.deposits.count} 笔`}
                icon={ArrowDownToLine}
                tone="sky"
              />
              <StatCard
                label="今日提现"
                value={usd(data.today.withdrawals.atomic)}
                sub={`${data.today.withdrawals.count} 笔完成 · 今日申请 ${data.today.withdrawalRequests.count} 笔`}
                icon={ArrowUpFromLine}
                tone="amber"
              />
              <StatCard
                label="待处理提现"
                value={usd(owed.toString())}
                sub={`待审核 ${data.pending.review.count} 笔 · 链上处理中 ${data.pending.inFlight.count} 笔`}
                icon={Clock}
                tone={data.pending.review.count > 0 ? 'rose' : 'slate'}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="glass-strong lg:col-span-2">
                <CardHeader><CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5" />热钱包（提现出款）</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.hotWallet.address ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div><p className="text-xs text-muted-foreground">USDT 余额</p><p className="text-xl font-bold tabular-nums">{usd(data.hotWallet.usdtAtomic)}</p></div>
                        <div><p className="text-xs text-muted-foreground">TRX（手续费）</p><p className="text-xl font-bold tabular-nums">{trx(data.hotWallet.trxSun)}</p></div>
                        <div className="min-w-0"><p className="text-xs text-muted-foreground">地址</p>
                          {explorer
                            ? <a href={explorer} target="_blank" rel="noopener noreferrer" className="block truncate font-mono text-xs text-mint hover:underline" title={data.hotWallet.address}>{data.hotWallet.address}</a>
                            : <p className="truncate font-mono text-xs">{data.hotWallet.address}</p>}
                        </div>
                      </div>
                      {data.hotWallet.error && <Notice tone="warn">链上余额读取失败{data.hotWallet.checkedAt ? `，显示 ${new Date(data.hotWallet.checkedAt).toLocaleTimeString('zh-CN', { hour12: false })} 的读数` : ''}：{data.hotWallet.error}</Notice>}
                      {hotUsdt !== null && (hotUsdt >= owed
                        ? <Notice tone="ok">热钱包足以支付全部待处理提现（{usd(owed.toString())} USDT）。</Notice>
                        : <Notice tone="warn">热钱包 USDT 不足以支付待处理提现，还差 {usd((owed - hotUsdt).toString())} USDT，请向热钱包补充资金。</Notice>)}
                      {hotTrx !== null && hotTrx < TRX_LOW_SUN && <Notice tone="warn">TRX 余额低于 100，提现可能因手续费不足失败，请补充 TRX。</Notice>}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">未配置热钱包（非手动托管模式）。</p>
                  )}
                </CardContent>
              </Card>
              <Card className="glass-strong">
                <CardHeader><CardTitle>充值地址池</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div><p className="text-xs text-muted-foreground">待分配</p><p className={cn('text-xl font-bold tabular-nums', data.pool.available < POOL_LOW && 'text-amber-700')}>{data.pool.available}</p></div>
                    <div><p className="text-xs text-muted-foreground">使用中</p><p className="text-xl font-bold tabular-nums">{data.pool.current}</p></div>
                    <div><p className="text-xs text-muted-foreground">已轮换</p><p className="text-xl font-bold tabular-nums">{data.pool.retired}</p></div>
                  </div>
                  {data.pool.available < POOL_LOW
                    ? <Notice tone="warn">待分配地址少于 {POOL_LOW} 个，请在「钱包财资」上传。{data.pool.available === 0 ? '当前新用户无法获取充值地址。' : ''}</Notice>
                    : <Notice tone="ok">地址库存充足。</Notice>}
                  {data.pending.manualReview.count > 0 && <Notice tone="warn">{data.pending.manualReview.count} 笔充值待人工审核（{usd(data.pending.manualReview.atomic)} USDT）。</Notice>}
                </CardContent>
              </Card>
            </div>

            <Card className="glass-strong">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>每日充值与提现（USDT）</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowTable((value) => !value)}>{showTable ? '看图表' : '看数据表'}</Button>
              </CardHeader>
              <CardContent>{showTable ? <FundsTable series={data.series} /> : <FlowsChart series={data.series} />}</CardContent>
            </Card>

            {!showTable && (
              <Card className="glass-strong">
                <CardHeader><CardTitle>用户余额走势（日终，USDT）</CardTitle></CardHeader>
                <CardContent><BalanceChart series={data.series} /></CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground">
              累计入账充值 {usd(data.allTime.deposits.atomic)} USDT（{data.allTime.deposits.count} 笔）· 累计完成提现 {usd(data.allTime.withdrawals.atomic)} USDT（{data.allTime.withdrawals.count} 笔）· 用户已投资 {usd(data.balances.investedAtomic)} · 待发奖励 {usd(data.balances.rewardPayableAtomic)}
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
