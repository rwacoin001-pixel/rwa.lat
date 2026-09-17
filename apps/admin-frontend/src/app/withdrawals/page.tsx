'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, Eye, MoreHorizontal, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, Copy, RefreshCw, Play, Pause, ShieldCheck } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type UiStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed' | 'cancelled';

interface Withdrawal {
  id: string;
  userId: string;
  chain: string;
  asset: string;
  amount: string;
  amountUsd: string;
  fee: string;
  feeUsd: string;
  destinationAddress: string;
  status: UiStatus;
  priority: 'normal' | 'high' | 'urgent';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requestedAt: string;
  reviewedAt?: string;
  completedAt?: string;
  txHash?: string;
  reasonCode?: string | null;
  approvals: number;
  approvalsRequired: number;
  requiresDualApproval: boolean;
  rawState: string;
}

interface FundsSwitchState {
  enabled: boolean;
  reason: string | null;
  updatedAt: string | null;
}

interface FundsSwitchView {
  current: FundsSwitchState | null;
  pending: Array<{ id: string; changeId: string; requestedAt: string; reason: string }>;
  environmentAllowsExecution: boolean;
}

const CHAIN_LABELS: Record<string, string> = {
  tron: 'TRON',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
};

const STATUS_LABELS: Record<UiStatus, string> = {
  pending: '待处理',
  reviewing: '审核中',
  approved: '已批准',
  rejected: '已拒绝',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const STATUS_STYLES: Record<UiStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-600',
  reviewing: 'bg-blue-500/20 text-blue-600',
  approved: 'bg-mint/20 text-mint',
  rejected: 'bg-red-500/20 text-red-600',
  processing: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-mint/20 text-mint',
  failed: 'bg-red-500/20 text-red-600',
  cancelled: 'bg-gray-500/20 text-slate-500',
};

const DB_TO_UI: Record<string, UiStatus> = {
  requested: 'pending',
  '2fa_verified': 'pending',
  risk_review: 'reviewing',
  approved: 'approved',
  signing: 'processing',
  broadcast: 'processing',
  confirming: 'processing',
  completed: 'completed',
  rejected: 'rejected',
  failed: 'failed',
  cancelled: 'cancelled',
};

const UI_TO_DB: Record<UiStatus, string[]> = {
  pending: ['requested', '2fa_verified'],
  reviewing: ['risk_review'],
  approved: ['approved'],
  processing: ['signing', 'broadcast', 'confirming'],
  completed: ['completed'],
  rejected: ['rejected'],
  failed: ['failed'],
  cancelled: ['cancelled'],
};

const RISK_STYLES: Record<string, string> = {
  low: 'bg-green-500/20 text-emerald-600',
  medium: 'bg-amber-500/20 text-amber-600',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-600',
};

function formatAtomic(atomic: string, decimals = 6): string {
  try {
    const value = BigInt(atomic || '0');
    const base = BigInt(10) ** BigInt(decimals);
    const whole = value / base;
    const frac = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  } catch {
    return atomic;
  }
}

function mapWithdrawal(raw: Record<string, any>): Withdrawal {
  const snapshot = (raw.policySnapshot || {}) as Record<string, unknown>;
  const approvalsRequired = Number(snapshot.approvalsRequired ?? 0);
  const amount = formatAtomic(String(raw.atomicAmount || '0'));
  const fee = formatAtomic(String(raw.feeAtomicAmount || '0'));
  const uiStatus = DB_TO_UI[String(raw.state)] ?? 'pending';
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    chain: String(raw.network),
    asset: 'USDT',
    amount,
    amountUsd: `$${amount}`,
    fee,
    feeUsd: `$${fee}`,
    destinationAddress: String(raw.destination || ''),
    status: uiStatus,
    priority: uiStatus === 'reviewing' && approvalsRequired > 0 && Number(raw.approvals ?? 0) === 0 ? 'high' : 'normal',
    riskLevel: approvalsRequired >= 2 ? 'medium' : 'low',
    requestedAt: String(raw.requestedAt || ''),
    reviewedAt: raw.approvedAt ? String(raw.approvedAt) : undefined,
    completedAt: raw.completedAt ? String(raw.completedAt) : undefined,
    txHash: raw.transactionHash ? String(raw.transactionHash) : undefined,
    reasonCode: raw.reasonCode ?? null,
    approvals: Number(raw.approvals ?? 0),
    approvalsRequired,
    requiresDualApproval: approvalsRequired >= 2,
    rawState: String(raw.state),
  };
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [chainFilter, setChainFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [funds, setFunds] = useState<FundsSwitchView | null>(null);

  useEffect(() => {
    fetchWithdrawals();
    fetchFunds();
  }, []);

  const fetchWithdrawals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/wallet/withdrawals?limit=200', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `获取提现列表失败 (HTTP ${res.status})`);
      }
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data.items || [];
      setWithdrawals(rows.map(mapWithdrawal));
    } catch (err) {
      setWithdrawals([]);
      setError(err instanceof Error ? err.message : '获取提现列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchFunds = async () => {
    try {
      const res = await fetch('/api/admin/operations/funds/withdrawal-execution', { credentials: 'include' });
      if (!res.ok) return setFunds(null);
      const data = await res.json();
      setFunds({
        current: data.current
          ? { enabled: Boolean(data.current.enabled), reason: data.current.reason ?? null, updatedAt: data.current.updatedAt ?? null }
          : null,
        pending: Array.isArray(data.pending) ? data.pending : [],
        environmentAllowsExecution: Boolean(data.environmentAllowsExecution),
      });
    } catch {
      setFunds(null);
    }
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return withdrawals.filter((row) => {
      if (statusFilter && !UI_TO_DB[statusFilter as UiStatus]?.includes(row.rawState)) return false;
      if (chainFilter && row.chain !== chainFilter) return false;
      if (!keyword) return true;
      return (
        row.id.toLowerCase().includes(keyword) ||
        row.userId.toLowerCase().includes(keyword) ||
        row.destinationAddress.toLowerCase().includes(keyword) ||
        (row.txHash || '').toLowerCase().includes(keyword)
      );
    });
  }, [withdrawals, search, statusFilter, chainFilter]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  const callAction = async (path: string, init?: RequestInit) => {
    setBusy(true);
    try {
      const res = await fetch(path, { credentials: 'include', ...init });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `操作失败 (HTTP ${res.status})`);
      return body;
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (action: string, withdrawal: Withdrawal) => {
    try {
      switch (action) {
        case 'view':
          await navigator.clipboard.writeText(withdrawal.destinationAddress).catch(() => undefined);
          alert(`提现 ${withdrawal.id.slice(0, 8)}\n用户: ${withdrawal.userId}\n金额: ${withdrawal.amount} USDT\n目的地址（已复制）: ${withdrawal.destinationAddress}\n状态: ${withdrawal.rawState}\n审批: ${withdrawal.approvals}/${withdrawal.approvalsRequired || 1}${withdrawal.reasonCode ? `\n原因: ${withdrawal.reasonCode}` : ''}`);
          break;
        case 'approve': {
          if (!confirm(`确定批准提现 ${withdrawal.id.slice(0, 8)} 吗？\n批准人数达到要求后进入执行队列。`)) return;
          const result = await callAction(`/api/admin/wallet/withdrawals/${withdrawal.id}/approve`, {
            method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
          });
          alert(result?.state === 'approved' ? '审批已满足，提现进入执行队列' : `已记录审批 ${result?.approvalCount ?? ''}/${result?.approvalsRequired ?? ''}，还需其他管理员批准`);
          await fetchWithdrawals();
          break;
        }
        case 'reject': {
          const reason = prompt('请输入拒绝原因：');
          if (!reason) return;
          await callAction(`/api/admin/wallet/withdrawals/${withdrawal.id}/reject`, {
            method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reasonCode: reason }),
          });
          alert('已拒绝并退回锁定资金');
          await fetchWithdrawals();
          break;
        }
        case 'process': {
          if (!confirm(`确定执行提现 ${withdrawal.id.slice(0, 8)} 吗？\n将调用热钱包签名并广播到链上。`)) return;
          await callAction(`/api/admin/wallet/withdrawals/${withdrawal.id}/execute`, { method: 'POST' });
          alert('已提交链上广播');
          await fetchWithdrawals();
          break;
        }
        case 'tx':
          if (withdrawal.txHash) {
            window.open(`https://tronscan.org/#/transaction/${withdrawal.txHash}`, '_blank');
          }
          break;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const pauseFunds = async () => {
    const reason = prompt('暂停提现执行的原因：');
    if (!reason) return;
    try {
      await callAction('/api/admin/operations/funds/withdrawal-execution/pause', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }),
      });
      alert('提现执行已暂停');
      await fetchFunds();
    } catch (err) {
      alert(err instanceof Error ? err.message : '暂停失败');
    }
  };

  const requestResume = async () => {
    const changeId = prompt('变更单号（审计记录用，字母数字）：');
    if (!changeId) return;
    const reason = prompt('申请恢复的原因：');
    if (!reason) return;
    try {
      await callAction('/api/admin/operations/funds/withdrawal-execution/resume-requests', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ changeId, reason }),
      });
      alert('已提交恢复申请，需由另一位管理员批准后生效');
      await fetchFunds();
    } catch (err) {
      alert(err instanceof Error ? err.message : '提交失败');
    }
  };

  const todayAmount = withdrawals
    .filter((w) => w.requestedAt && new Date(w.requestedAt).toDateString() === new Date().toDateString())
    .reduce((sum, w) => sum + Number(w.amount), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">提现审批</h1>
            <p className="text-muted-foreground mt-1">手动托管模式：白名单用户自动打款，其余双人审批后热钱包签名广播</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => { fetchWithdrawals(); fetchFunds(); }} disabled={busy}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
          </div>
        </div>

        {/* Funds Execution Switch */}
        <Card className="glass-strong">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className={cn('w-5 h-5', funds?.current?.enabled ? 'text-mint' : 'text-amber-600')} />
              <div>
                <p className="text-sm font-medium">
                  提现执行开关：
                  {funds?.current ? (funds.current.enabled ? '执行中' : '已暂停') : '未配置'}
                  {funds && !funds.environmentAllowsExecution && '（环境变量未开启资金执行）'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {funds?.current?.updatedAt ? `最近变更: ${new Date(funds.current.updatedAt).toLocaleString('zh-CN')}` : ''}
                  {funds?.pending?.length ? ` ｜ 待批准恢复申请: ${funds.pending.length}` : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {funds?.pending?.length ? (
                <>
                  <Button
                    className="flex items-center gap-2"
                    disabled={busy}
                    onClick={async () => {
                      const target = funds.pending[0];
                      if (!target) return;
                      if (!confirm(`批准恢复申请 ${target.changeId} 吗？（需由发起人以外的管理员操作）`)) return;
                      try {
                        await callAction(`/api/admin/operations/funds/withdrawal-execution/resume-requests/${target.id}/approve`, { method: 'PUT' });
                        alert('已批准，提现执行恢复启用');
                        await fetchFunds();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : '批准失败');
                      }
                    }}
                  >
                    <Play className="w-4 h-4" />
                    批准恢复
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={busy}
                    onClick={async () => {
                      const target = funds.pending[0];
                      if (!target) return;
                      if (!confirm(`拒绝恢复申请 ${target.changeId} 吗？`)) return;
                      try {
                        await callAction(`/api/admin/operations/funds/withdrawal-execution/resume-requests/${target.id}/reject`, { method: 'PUT' });
                        alert('已拒绝该恢复申请');
                        await fetchFunds();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : '操作失败');
                      }
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    拒绝恢复
                  </Button>
                </>
              ) : null}
              <Button variant="outline" className="flex items-center gap-2" onClick={pauseFunds} disabled={busy || !funds?.current?.enabled}>
                <Pause className="w-4 h-4" />
                紧急暂停
              </Button>
              <Button className="flex items-center gap-2" onClick={requestResume} disabled={busy || !funds?.current || funds.current.enabled}>
                <Play className="w-4 h-4" />
                申请恢复
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="glass-strong border-amber-500/40">
            <CardContent className="p-4 text-sm text-amber-600">
              提现数据加载失败：{error}（确认核心服务已配置 CORE_API_URL / ADMIN_SERVICE_TOKEN）
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">审核中</p>
                  <p className="text-2xl font-bold mt-1 text-blue-600">{withdrawals.filter((w) => w.status === 'reviewing').length}</p>
                </div>
                <Clock className="w-10 h-10 text-blue-600/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已批准待执行</p>
                  <p className="text-2xl font-bold mt-1 text-mint">{withdrawals.filter((w) => w.status === 'approved').length}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">链上处理中</p>
                  <p className="text-2xl font-bold mt-1 text-purple-400">{withdrawals.filter((w) => w.status === 'processing').length}</p>
                </div>
                <Clock className="w-10 h-10 text-purple-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">需双人审批</p>
                  <p className="text-2xl font-bold mt-1 text-purple-400">{withdrawals.filter((w) => w.requiresDualApproval && w.status === 'reviewing').length}</p>
                </div>
                <DollarSign className="w-10 h-10 text-purple-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日申请 (USDT)</p>
                  <p className="text-2xl font-bold mt-1 text-sky-600">{todayAmount.toLocaleString()}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-sky-600/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已完成</p>
                  <p className="text-2xl font-bold mt-1">{withdrawals.filter((w) => w.status === 'completed').length}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户、地址、TXID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="reviewing">审核中</SelectItem>
                  <SelectItem value="approved">已批准</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                </SelectContent>
              </Select>
              <Select value={chainFilter} onValueChange={(v) => { setChainFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="链" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="tron">TRON</SelectItem>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Withdrawals Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>提现列表 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">每页</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" />
              </div>
            ) : paged.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <DollarSign className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无提现记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">ID</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead className="w-20">链</TableHead>
                      <TableHead className="w-28">金额</TableHead>
                      <TableHead>目的地址</TableHead>
                      <TableHead className="w-28">审批</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-32">时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((w) => (
                      <TableRow key={w.id} className="hover:bg-ink/[0.05]">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {w.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">用户 {w.userId.slice(0, 8)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{CHAIN_LABELS[w.chain] ?? w.chain}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-mono tabular-nums font-medium">{w.amount} {w.asset}</p>
                            <p className="text-xs text-muted-foreground">手续费: {w.fee}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate" title={w.destinationAddress}>
                          {w.destinationAddress.slice(0, 10)}...{w.destinationAddress.slice(-8)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className={cn(w.requiresDualApproval ? 'text-purple-400' : 'text-muted-foreground')}>
                            {w.approvals}/{w.approvalsRequired || 1}
                          </span>
                          {w.requiresDualApproval && (
                            <span className="ml-1 inline-flex items-center gap-1 text-xs text-purple-400">
                              <span className="w-2 h-2 rounded-full bg-purple-400" />
                              双审
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[w.status])}>
                            {STATUS_LABELS[w.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <p>{w.requestedAt ? new Date(w.requestedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                          {w.completedAt && (
                            <p className="text-xs text-mint">完成: {new Date(w.completedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAction('view', w)}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(w.destinationAddress)}>
                                <Copy className="w-4 h-4 mr-2" />
                                复制地址
                              </DropdownMenuItem>
                              {w.status === 'reviewing' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleAction('approve', w)} className="text-mint">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    批准
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAction('reject', w)} className="text-destructive">
                                    <XCircle className="w-4 h-4 mr-2" />
                                    拒绝
                                  </DropdownMenuItem>
                                </>
                              )}
                              {w.status === 'approved' && (
                                <DropdownMenuItem onClick={() => handleAction('process', w)} className="text-mint">
                                  <Play className="w-4 h-4 mr-2" />
                                  执行打款
                                </DropdownMenuItem>
                              )}
                              {w.txHash && (
                                <DropdownMenuItem onClick={() => handleAction('tx', w)}>
                                  查看链上交易
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-4 border-t border-ink/[0.07]">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  showPageSize
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
