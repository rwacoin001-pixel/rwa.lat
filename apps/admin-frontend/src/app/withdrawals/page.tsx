'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog, type ConfirmDetail } from '@/components/confirm-dialog';
import { cn } from '@/lib/utils';
import { adminErrorMessage } from '@/lib/admin-errors';
import { formatAtomic, sumAtomic } from '@/lib/money';
import { assetDecimals, networkLabel, txExplorerUrl, WALLET_NETWORKS } from '@/lib/chains';

type UiStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Mirrors the fields returned by GET /admin/wallet/withdrawals (apps/api WalletService.listRecentWithdrawals).
interface Withdrawal {
  id: string;
  userId: string;
  network: string;
  assetCode: string;
  decimals: number;
  atomicAmount: string;
  feeAtomicAmount: string;
  amount: string;
  fee: string;
  destinationAddress: string;
  status: UiStatus | null;
  rawState: string;
  requestedAt: string;
  approvedAt?: string;
  completedAt?: string;
  txHash?: string;
  reasonCode?: string | null;
  approvals: number;
  approvalsRequired: number;
  requiresApproval: boolean;
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

type PendingAction =
  | { kind: 'approve' | 'reject' | 'execute'; withdrawal: Withdrawal }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'resume-approve' | 'resume-reject'; target: FundsSwitchView['pending'][number] };

const ALL = 'all';

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

// Every WithdrawalState defined in apps/api/src/wallet/wallet.entities.ts.
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

const DB_TO_UI: Record<string, UiStatus> = Object.fromEntries(
  (Object.entries(UI_TO_DB) as Array<[UiStatus, string[]]>).flatMap(([ui, states]) => states.map((s) => [s, ui])),
);

function mapWithdrawal(raw: Record<string, any>): Withdrawal {
  const snapshot = (raw.policySnapshot || {}) as Record<string, unknown>;
  const approvalsRequired = Number(raw.approvalsRequired ?? snapshot.approvalsRequired ?? 1);
  const network = String(raw.network ?? '');
  const decimals = assetDecimals(network);
  const atomicAmount = String(raw.atomicAmount ?? '');
  const feeAtomicAmount = String(raw.feeAtomicAmount ?? '');
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    network,
    assetCode: raw.assetCode ? String(raw.assetCode) : '—',
    decimals,
    atomicAmount,
    feeAtomicAmount,
    amount: atomicAmount ? formatAtomic(atomicAmount, decimals) : '—',
    fee: feeAtomicAmount ? formatAtomic(feeAtomicAmount, decimals) : '—',
    destinationAddress: String(raw.destination || ''),
    status: DB_TO_UI[String(raw.state)] ?? null,
    rawState: String(raw.state),
    requestedAt: String(raw.requestedAt || ''),
    approvedAt: raw.approvedAt ? String(raw.approvedAt) : undefined,
    completedAt: raw.completedAt ? String(raw.completedAt) : undefined,
    txHash: raw.transactionHash ? String(raw.transactionHash) : undefined,
    reasonCode: raw.reasonCode ?? null,
    approvals: Number(raw.approvals ?? 0),
    approvalsRequired,
    requiresApproval: approvalsRequired > 0,
  };
}

function withdrawalDetails(w: Withdrawal): ConfirmDetail[] {
  return [
    { label: '提现编号', value: w.id, mono: true },
    { label: '用户', value: w.userId, mono: true },
    { label: '金额', value: `${w.amount} ${w.assetCode}`, mono: true, emphasis: true },
    { label: '手续费', value: `${w.fee} ${w.assetCode}`, mono: true },
    { label: '资产', value: w.assetCode },
    { label: '网络', value: networkLabel(w.network) },
    { label: '目的地址', value: w.destinationAddress || '—', mono: true, emphasis: true },
    { label: '审批', value: `${w.approvals}/${w.approvalsRequired || 1}` },
  ];
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [chainFilter, setChainFilter] = useState(ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [funds, setFunds] = useState<FundsSwitchView | null>(null);
  const [fundsLoading, setFundsLoading] = useState(true);
  const [fundsError, setFundsError] = useState('');
  const fundsRequest = useRef(0);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [changeId, setChangeId] = useState('');
  const [viewing, setViewing] = useState<Withdrawal | null>(null);

  useEffect(() => {
    fetchWithdrawals();
    fetchFunds();
  }, []);

  const fetchWithdrawals = async () => {
    setLoading(true);
    setError('');
    try {
      // Backend caps at 200 and has no offset/cursor, so paging and stats below are client-side over the latest 200.
      const res = await fetch('/api/admin/wallet/withdrawals?limit=200', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(adminErrorMessage(body, res.status));
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
    const requestId = ++fundsRequest.current;
    setFundsLoading(true);
    setFundsError('');
    try {
      const res = await fetch('/api/admin/operations/funds/withdrawal-execution', { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(adminErrorMessage(data, res.status));
      if (!data || !('current' in data) || !Array.isArray(data.pending) || typeof data.environmentAllowsExecution !== 'boolean') throw new Error('未能读取提现执行状态，请刷新重试。');
      if (requestId !== fundsRequest.current) return;
      setFunds({
        current: data.current
          ? { enabled: Boolean(data.current.enabled), reason: data.current.reason ?? null, updatedAt: data.current.updatedAt ?? null }
          : null,
        pending: Array.isArray(data.pending) ? data.pending : [],
        environmentAllowsExecution: Boolean(data.environmentAllowsExecution),
      });
    } catch (err) {
      if (requestId === fundsRequest.current) {
        setFunds(null);
        setFundsError(err instanceof Error ? err.message : '无法读取提现执行状态');
      }
    } finally {
      if (requestId === fundsRequest.current) setFundsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return withdrawals.filter((row) => {
      if (statusFilter !== ALL && !UI_TO_DB[statusFilter as UiStatus]?.includes(row.rawState)) return false;
      if (chainFilter !== ALL && row.network !== chainFilter) return false;
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

  const networkOptions = useMemo(() => {
    const ids = new Set<string>(WALLET_NETWORKS.map((n) => n.id));
    withdrawals.forEach((w) => w.network && ids.add(w.network));
    return Array.from(ids);
  }, [withdrawals]);

  const callAction = async (path: string, init?: RequestInit) => {
    setBusy(true);
    try {
      const res = await fetch(path, { credentials: 'include', ...init });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(adminErrorMessage(body, res.status));
      return body;
    } finally {
      setBusy(false);
    }
  };

  const openAction = (next: PendingAction) => {
    setReason('');
    setChangeId('');
    setNotice(null);
    setAction(next);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ kind: 'ok', text: '地址已复制' });
    } catch {
      setNotice({ kind: 'error', text: '复制失败，请手动选择地址' });
    }
  };

  const reasonValid = reason.trim().length >= 3;
  const changeIdValid = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(changeId.trim());

  const runAction = async () => {
    if (!action) return;
    const json = { 'content-type': 'application/json' };
    switch (action.kind) {
      case 'approve': {
        const result = await callAction(`/api/admin/wallet/withdrawals/${action.withdrawal.id}/approve`, {
          method: 'PUT', headers: json, body: JSON.stringify({}),
        });
        setNotice({ kind: 'ok', text: result?.state === 'approved' ? '审批已通过，提现进入执行队列' : `审批记录已更新 ${result?.approvalCount ?? ''}/${result?.approvalsRequired ?? 1}` });
        await fetchWithdrawals();
        break;
      }
      case 'reject':
        if (!reasonValid) throw new Error('请填写拒绝原因（至少 3 个字符）');
        await callAction(`/api/admin/wallet/withdrawals/${action.withdrawal.id}/reject`, {
          method: 'PUT', headers: json, body: JSON.stringify({ reasonCode: reason.trim() }),
        });
        setNotice({ kind: 'ok', text: '已拒绝并退回锁定资金' });
        await fetchWithdrawals();
        break;
      case 'execute':
        await callAction(`/api/admin/wallet/withdrawals/${action.withdrawal.id}/execute`, { method: 'POST' });
        setNotice({ kind: 'ok', text: '已提交链上广播' });
        await fetchWithdrawals();
        break;
      case 'pause':
        if (!reasonValid) throw new Error('请填写暂停原因（至少 3 个字符）');
        await callAction('/api/admin/operations/funds/withdrawal-execution/pause', {
          method: 'POST', headers: json, body: JSON.stringify({ reason: reason.trim() }),
        });
        setNotice({ kind: 'ok', text: '提现执行已暂停' });
        await fetchFunds();
        break;
      case 'resume':
        if (!changeIdValid) throw new Error('变更单号格式不正确');
        if (!reasonValid) throw new Error('请填写恢复原因（至少 3 个字符）');
        await callAction('/api/admin/operations/funds/withdrawal-execution/resume-requests', {
          method: 'POST', headers: json, body: JSON.stringify({ changeId: changeId.trim(), reason: reason.trim() }),
        });
        setNotice({ kind: 'ok', text: '已提交恢复申请，请核对后点击批准恢复' });
        await fetchFunds();
        break;
      case 'resume-approve':
        await callAction(`/api/admin/operations/funds/withdrawal-execution/resume-requests/${action.target.id}/approve`, { method: 'PUT' });
        setNotice({ kind: 'ok', text: '已批准，提现执行恢复启用' });
        await fetchFunds();
        break;
      case 'resume-reject':
        await callAction(`/api/admin/operations/funds/withdrawal-execution/resume-requests/${action.target.id}/reject`, { method: 'PUT' });
        setNotice({ kind: 'ok', text: '已拒绝该恢复申请' });
        await fetchFunds();
        break;
    }
  };

  const dialog = (() => {
    if (!action) return null;
    const reasonBox = (label: string, placeholder: string, max: number) => (
      <label className="grid gap-1.5 text-sm">
        <span>{label}</span>
        <textarea
          rows={3}
          maxLength={max}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-ink/[0.14] bg-white/70 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint"
        />
      </label>
    );
    switch (action.kind) {
      case 'approve':
        return { title: '批准提现', description: '批准人数达到要求后进入执行队列。', details: withdrawalDetails(action.withdrawal), confirmLabel: '确认批准' };
      case 'reject':
        return {
          title: '拒绝提现', description: '拒绝后锁定资金将退回用户可用余额。', details: withdrawalDetails(action.withdrawal),
          confirmLabel: '确认拒绝', destructive: true, confirmDisabled: !reasonValid,
          children: reasonBox('拒绝原因（必填，3-120 字符）', '例如：目的地址命中风控名单', 120),
        };
      case 'execute':
        return {
          title: '执行打款', description: '将调用热钱包签名并广播到链上，广播后无法撤回。', details: withdrawalDetails(action.withdrawal),
          confirmLabel: '确认执行打款', destructive: true,
          typeToConfirm: action.withdrawal.amount, typeToConfirmLabel: `请输入金额 ${action.withdrawal.amount} 以确认打款`,
        };
      case 'pause':
        return {
          title: '紧急暂停提现执行', description: '暂停后所有已批准提现停止广播，恢复需另行申请并批准。', details: [],
          confirmLabel: '确认暂停', destructive: true, confirmDisabled: !reasonValid,
          children: reasonBox('暂停原因（必填）', '例如：热钱包异常排查', 240),
        };
      case 'resume':
        return {
          title: '申请恢复提现执行', details: [], confirmLabel: '提交申请', confirmDisabled: !reasonValid || !changeIdValid,
          children: (
            <>
              <label className="grid gap-1.5 text-sm">
                <span>变更单号（审计记录用，字母数字）</span>
                <Input value={changeId} onChange={(e) => setChangeId(e.target.value)} className="font-mono" autoComplete="off" />
              </label>
              {reasonBox('申请恢复的原因（必填）', '', 240)}
            </>
          ),
        };
      case 'resume-approve':
        return {
          title: '批准恢复提现执行', description: '批准后已批准的提现将恢复链上广播。',
          details: [{ label: '变更单号', value: action.target.changeId, mono: true }, { label: '原因', value: action.target.reason }],
          confirmLabel: '确认批准恢复', destructive: true,
        };
      case 'resume-reject':
        return {
          title: '拒绝恢复申请',
          details: [{ label: '变更单号', value: action.target.changeId, mono: true }, { label: '原因', value: action.target.reason }],
          confirmLabel: '确认拒绝',
        };
    }
  })();

  const todayTotals = useMemo(() => {
    const today = new Date().toDateString();
    const groups = new Map<string, { decimals: number; values: string[] }>();
    for (const w of withdrawals) {
      if (!w.requestedAt || new Date(w.requestedAt).toDateString() !== today || !w.atomicAmount) continue;
      const key = `${w.assetCode}:${w.decimals}`;
      const group = groups.get(key) ?? { decimals: w.decimals, values: [] };
      group.values.push(w.atomicAmount);
      groups.set(key, group);
    }
    return Array.from(groups.entries()).map(([key, g]) => ({
      asset: key.split(':')[0],
      total: formatAtomic(sumAtomic(g.values), g.decimals, { group: true }),
    }));
  }, [withdrawals]);

  const viewingTxUrl = viewing ? txExplorerUrl(viewing.network, viewing.txHash) : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">

          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => { fetchWithdrawals(); fetchFunds(); }} disabled={busy}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
          </div>
        </div>

        {notice && (
          <Card className={cn('glass-strong', notice.kind === 'error' && 'border-amber-500/40')}>
            <CardContent role="status" className={cn('p-4 text-sm', notice.kind === 'error' ? 'text-amber-600' : 'text-mint')}>
              {notice.text}
            </CardContent>
          </Card>
        )}

        {/* Funds Execution Switch */}
        <Card className="glass-strong">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className={cn('w-5 h-5', funds?.current?.enabled ? 'text-mint' : 'text-amber-600')} />
              <div>
                <p className="text-sm font-medium">
                  提现执行开关：
                  {fundsLoading ? '读取中…' : fundsError ? '读取失败' : funds?.current ? (funds.current.enabled ? '执行中' : '已暂停') : '未配置'}
                  {funds && !funds.environmentAllowsExecution && '（环境变量未开启资金执行）'}
                </p>
                {fundsError && <p role="alert" className="text-xs text-amber-600">{fundsError}</p>}
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
                    disabled={busy || fundsLoading || Boolean(fundsError) || !funds.environmentAllowsExecution}
                    onClick={() => { const target = funds.pending[0]; if (target) openAction({ kind: 'resume-approve', target }); }}
                  >
                    <Play className="w-4 h-4" />
                    批准恢复
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={busy || fundsLoading || Boolean(fundsError)}
                    onClick={() => { const target = funds.pending[0]; if (target) openAction({ kind: 'resume-reject', target }); }}
                  >
                    <XCircle className="w-4 h-4" />
                    拒绝恢复
                  </Button>
                </>
              ) : null}
              <Button variant="outline" className="flex items-center gap-2" onClick={() => openAction({ kind: 'pause' })} disabled={busy || fundsLoading || Boolean(fundsError) || !funds?.current?.enabled}>
                <Pause className="w-4 h-4" />
                紧急暂停
              </Button>
              <Button className="flex items-center gap-2" onClick={() => openAction({ kind: 'resume' })} disabled={busy || fundsLoading || Boolean(fundsError) || !funds?.current || funds.current.enabled || !funds.environmentAllowsExecution}>
                <Play className="w-4 h-4" />
                申请恢复
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="glass-strong border-amber-500/40">
            <CardContent className="p-4 text-sm text-amber-600">
              提现数据加载失败：{error}
            </CardContent>
          </Card>
        )}

        {/* Stats Cards (computed over the latest 200 records returned by the backend) */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待处理</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600">{withdrawals.filter((w) => w.status === 'pending').length}</p>
                </div>
                <Clock className="w-10 h-10 text-amber-600/50" />
              </div>
            </CardContent>
          </Card>
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
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">今日申请</p>
                  {todayTotals.length === 0 ? (
                    <p className="text-2xl font-bold mt-1 text-sky-600">0</p>
                  ) : (
                    todayTotals.map((t) => (
                      <p key={t.asset} className="text-lg font-bold mt-1 text-sky-600 font-mono tabular-nums break-all">{t.total} <span className="text-xs">{t.asset}</span></p>
                    ))
                  )}
                </div>
                <AlertTriangle className="w-10 h-10 shrink-0 text-sky-600/50" />
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
                  <SelectItem value={ALL}>全部状态</SelectItem>
                  {(Object.keys(STATUS_LABELS) as UiStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={chainFilter} onValueChange={(v) => { setChainFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="链" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>全部链</SelectItem>
                  {networkOptions.map((n) => (
                    <SelectItem key={n} value={n}>{networkLabel(n)}</SelectItem>
                  ))}
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
            <CardTitle>提现列表 (共 {totalCount} 条{withdrawals.length >= 200 ? '，仅显示最近 200 条' : ''})</CardTitle>
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
                    {paged.map((w) => {
                      const txUrl = txExplorerUrl(w.network, w.txHash);
                      return (
                        <TableRow key={w.id} className="hover:bg-ink/[0.05]">
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {w.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-xs">用户 {w.userId.slice(0, 8)}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{networkLabel(w.network)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-mono tabular-nums font-medium">{w.amount} {w.assetCode}</p>
                              <p className="text-xs text-muted-foreground">手续费: {w.fee}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate" title={w.destinationAddress}>
                            {w.destinationAddress.slice(0, 10)}...{w.destinationAddress.slice(-8)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className={cn(w.requiresApproval ? 'text-purple-400' : 'text-muted-foreground')}>
                              {w.approvals}/{w.approvalsRequired || 1}
                            </span>
                            {w.requiresApproval && (
                              <span className="ml-1 inline-flex items-center gap-1 text-xs text-purple-400">
                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                人工审批
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(w.status ? STATUS_STYLES[w.status] : 'bg-gray-500/20 text-slate-500')} title={w.rawState}>
                              {w.status ? STATUS_LABELS[w.status] : w.rawState}
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
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setViewing(w)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  查看详情
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void copy(w.destinationAddress)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  复制地址
                                </DropdownMenuItem>
                                {w.status === 'reviewing' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem disabled={busy} onClick={() => openAction({ kind: 'approve', withdrawal: w })} className="text-mint">
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      批准
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled={busy} onClick={() => openAction({ kind: 'reject', withdrawal: w })} className="text-destructive">
                                      <XCircle className="w-4 h-4 mr-2" />
                                      拒绝
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {w.status === 'approved' && (
                                  <DropdownMenuItem disabled={busy} onClick={() => openAction({ kind: 'execute', withdrawal: w })} className="text-mint">
                                    <Play className="w-4 h-4 mr-2" />
                                    执行打款
                                  </DropdownMenuItem>
                                )}
                                {txUrl && (
                                  <DropdownMenuItem onClick={() => window.open(txUrl, '_blank', 'noopener,noreferrer')}>
                                    查看链上交易
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => { if (!open) setAction(null); }}
        title={dialog?.title ?? ''}
        description={dialog?.description}
        details={dialog?.details}
        confirmLabel={dialog?.confirmLabel}
        destructive={dialog?.destructive}
        confirmDisabled={dialog?.confirmDisabled}
        typeToConfirm={dialog?.typeToConfirm}
        typeToConfirmLabel={dialog?.typeToConfirmLabel}
        onConfirm={runAction}
      >
        {dialog?.children}
      </ConfirmDialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提现详情</DialogTitle>
          </DialogHeader>
          {viewing && (
            <dl className="divide-y divide-ink/[0.06] rounded-xl border border-ink/[0.08] bg-ink/[0.02] text-sm">
              {[
                ...withdrawalDetails(viewing),
                { label: '状态', value: viewing.status ? `${STATUS_LABELS[viewing.status]}（${viewing.rawState}）` : viewing.rawState },
                { label: '申请时间', value: viewing.requestedAt ? new Date(viewing.requestedAt).toLocaleString('zh-CN') : '—' },
                { label: '批准时间', value: viewing.approvedAt ? new Date(viewing.approvedAt).toLocaleString('zh-CN') : '—' },
                { label: '完成时间', value: viewing.completedAt ? new Date(viewing.completedAt).toLocaleString('zh-CN') : '—' },
                { label: '原因', value: viewing.reasonCode || '—' },
                {
                  label: '交易哈希',
                  mono: true,
                  value: viewing.txHash
                    ? viewingTxUrl
                      ? <a href={viewingTxUrl} target="_blank" rel="noreferrer" className="text-mint hover:underline">{viewing.txHash}</a>
                      : viewing.txHash
                    : '—',
                },
              ].map((d) => (
                <div key={d.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">{d.label}</dt>
                  <dd className={cn('break-all', 'mono' in d && d.mono && 'font-mono text-xs leading-5')}>{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
