'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, MoreHorizontal, Wallet, Copy, Ban, Activity, RefreshCw, KeyRound, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cn } from '@/lib/utils';
import { addressExplorerUrl, networkLabel, WALLET_NETWORKS } from '@/lib/chains';

interface PoolAddress {
  id: string;
  network: string;
  address: string;
  state: 'available' | 'assigned' | 'disabled';
  source: 'generated' | 'imported';
  keyHeld: boolean;
  label: string | null;
  note: string | null;
  assignedUserId: string | null;
  assignedAt: string | null;
  lastScanAt: string | null;
  createdAt: string;
  disabledAt: string | null;
  disabledReason: string | null;
}

interface PoolStats {
  network: string;
  available: number;
  assigned: number;
  disabled: number;
  keyHeld: number;
  keyMissing: number;
}

const ALL = 'all';
// Backend list endpoint caps at 200 rows and has no offset/cursor.
const LIST_LIMIT = 200;

const STATE_LABELS: Record<string, string> = {
  available: '可用',
  assigned: '已分配',
  disabled: '已停用',
};

const STATE_STYLES: Record<string, string> = {
  available: 'bg-mint/20 text-mint',
  assigned: 'bg-blue-500/20 text-blue-600',
  disabled: 'bg-gray-500/20 text-slate-500',
};

export default function WalletsPage() {
  const [addresses, setAddresses] = useState<PoolAddress[]>([]);
  const [networkStats, setNetworkStats] = useState<PoolStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState(ALL);
  const [networkFilter, setNetworkFilter] = useState(ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateNetwork, setGenerateNetwork] = useState<string>('tron');
  const [generateCount, setGenerateCount] = useState('20');
  const [disableTarget, setDisableTarget] = useState<PoolAddress | null>(null);
  const [disableReason, setDisableReason] = useState('');

  const fetchPool = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(LIST_LIMIT) });
      if (networkFilter !== ALL) params.set('network', networkFilter);
      if (stateFilter !== ALL) params.set('state', stateFilter);
      const res = await fetch(`/api/admin/wallet/deposit-pool?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `获取地址池失败 (HTTP ${res.status})`);
      }
      const data = await res.json();
      setAddresses(data.addresses || []);
      setNetworkStats(Array.isArray(data.stats?.networks) ? data.stats.networks : []);
    } catch (err) {
      setAddresses([]);
      setNetworkStats([]);
      setError(err instanceof Error ? err.message : '获取地址池失败');
    } finally {
      setLoading(false);
    }
  }, [networkFilter, stateFilter]);

  useEffect(() => {
    void fetchPool();
  }, [fetchPool]);

  const networkOptions = useMemo(() => {
    const ids = new Set<string>(WALLET_NETWORKS.map((n) => n.id));
    networkStats.forEach((s) => ids.add(s.network));
    return Array.from(ids);
  }, [networkStats]);

  // Counts come from the backend's per-network aggregate, not the (capped) list.
  const stats = useMemo(() => {
    const rows = networkFilter === ALL ? networkStats : networkStats.filter((s) => s.network === networkFilter);
    return rows.reduce(
      (acc, s) => ({
        available: acc.available + s.available,
        assigned: acc.assigned + s.assigned,
        disabled: acc.disabled + s.disabled,
        keyHeld: acc.keyHeld + s.keyHeld,
        keyMissing: acc.keyMissing + s.keyMissing,
      }),
      { available: 0, assigned: 0, disabled: 0, keyHeld: 0, keyMissing: 0 },
    );
  }, [networkStats, networkFilter]);
  const totalAddresses = stats.available + stats.assigned + stats.disabled;

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return addresses.filter((row) => {
      if (!keyword) return true;
      return (
        row.address.toLowerCase().includes(keyword) ||
        (row.assignedUserId || '').toLowerCase().includes(keyword) ||
        (row.label || '').toLowerCase().includes(keyword)
      );
    });
  }, [addresses, search]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const countValid = /^\d+$/.test(generateCount.trim()) && Number(generateCount) >= 1 && Number(generateCount) <= 100;

  const openGenerate = () => {
    setNotice(null);
    setGenerateNetwork(networkFilter !== ALL ? networkFilter : 'tron');
    setGenerateCount('20');
    setGenerateOpen(true);
  };

  const handleGenerate = async () => {
    if (!countValid) throw new Error('数量必须是 1-100 的整数');
    setBusy(true);
    try {
      const count = Number(generateCount);
      const res = await fetch('/api/admin/wallet/deposit-pool/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ network: generateNetwork, count }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `生成失败 (HTTP ${res.status})`);
      setNotice({ kind: 'ok', text: `已在 ${networkLabel(generateNetwork)} 生成 ${body?.generated ?? count} 个地址` });
      await fetchPool();
    } finally {
      setBusy(false);
    }
  };

  const openDisable = (row: PoolAddress) => {
    setNotice(null);
    setDisableReason('');
    setDisableTarget(row);
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    setBusy(true);
    try {
      const reason = disableReason.trim();
      const res = await fetch(`/api/admin/wallet/deposit-pool/${disableTarget.id}/disable`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `停用失败 (HTTP ${res.status})`);
      setNotice({ kind: 'ok', text: '地址已停用' });
      await fetchPool();
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (row: PoolAddress) => {
    try {
      await navigator.clipboard.writeText(row.address);
      setNotice({ kind: 'ok', text: '地址已复制' });
    } catch {
      setNotice({ kind: 'error', text: `复制失败，请手动复制：${row.address}` });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setCurrentPage(1); void fetchPool(); }} disabled={busy} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button className="flex items-center gap-2" onClick={openGenerate} disabled={busy}>
              <Plus className="w-4 h-4" />
              生成地址
            </Button>
          </div>
        </div>

        {notice && (
          <Card className={cn('glass-strong', notice.kind === 'error' && 'border-amber-500/40')}>
            <CardContent role="status" className={cn('p-4 text-sm break-all', notice.kind === 'error' ? 'text-amber-600' : 'text-mint')}>
              {notice.text}
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="glass-strong border-amber-500/40">
            <CardContent className="p-4 text-sm text-amber-600">
              地址池数据加载失败：{error}（确认核心服务已配置 CORE_API_URL / ADMIN_SERVICE_TOKEN）
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总地址数{networkFilter !== ALL ? `（${networkLabel(networkFilter)}）` : ''}</p>
                  <p className="text-2xl font-bold mt-1">{totalAddresses}</p>
                </div>
                <Wallet className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">可用地址</p>
                  <p className="text-2xl font-bold mt-1 text-mint">{stats.available}</p>
                </div>
                <Activity className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已分配</p>
                  <p className="text-2xl font-bold mt-1 text-blue-600">{stats.assigned}</p>
                </div>
                <Wallet className="w-10 h-10 text-blue-600/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已停用</p>
                  <p className="text-2xl font-bold mt-1 text-slate-500">{stats.disabled}</p>
                </div>
                <Ban className="w-10 h-10 text-slate-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">密钥托管</p>
                  <p className="text-2xl font-bold mt-1">{stats.keyHeld}</p>
                  {stats.keyMissing > 0 && (
                    <p className="text-xs text-amber-600 mt-1">{stats.keyMissing} 个仅收币（无密钥）</p>
                  )}
                </div>
                <KeyRound className="w-10 h-10 text-sky-600/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索地址、用户ID、备注..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <Select value={networkFilter} onValueChange={(v) => { setNetworkFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="链" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>全部链</SelectItem>
                  {networkOptions.map((n) => (
                    <SelectItem key={n} value={n}>{networkLabel(n)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>全部状态</SelectItem>
                  <SelectItem value="available">可用</SelectItem>
                  <SelectItem value="assigned">已分配</SelectItem>
                  <SelectItem value="disabled">已停用</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Address Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>地址列表 (共 {totalCount} 条{addresses.length >= LIST_LIMIT ? `，仅显示最近 ${LIST_LIMIT} 条` : ''})</CardTitle>
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
                <Wallet className="w-12 h-12 mb-4 opacity-50" />
                <p>{totalAddresses === 0 && networkFilter === ALL ? '地址池为空，点击右上角「生成地址」开始' : '没有符合筛选条件的地址'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">链</TableHead>
                      <TableHead>地址</TableHead>
                      <TableHead>分配用户</TableHead>
                      <TableHead className="w-24">来源</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-28">密钥</TableHead>
                      <TableHead className="w-32">分配时间</TableHead>
                      <TableHead className="w-32">创建时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((row) => {
                      const explorerUrl = addressExplorerUrl(row.network, row.address);
                      return (
                        <TableRow key={row.id} className="hover:bg-ink/[0.05]">
                          <TableCell>
                            <Badge variant="outline">{networkLabel(row.network)}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <button
                              className="text-left hover:text-mint"
                              title={`${row.address}（点击复制）`}
                              onClick={() => handleCopy(row)}
                            >
                              {row.address.slice(0, 10)}...{row.address.slice(-8)}
                            </button>
                            {row.label && <p className="text-muted-foreground">{row.label}</p>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.assignedUserId ? (
                              <span className="font-mono text-xs">用户 {row.assignedUserId.slice(0, 8)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-cyan-500/20 text-sky-600">
                              {row.source === 'generated' ? '系统生成' : '导入'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(STATE_STYLES[row.state])}>
                              {STATE_LABELS[row.state] ?? row.state}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.keyHeld ? (
                              <span className="text-mint">已托管</span>
                            ) : (
                              <span className="text-amber-600">仅收币</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.assignedAt ? new Date(row.assignedAt).toLocaleDateString('zh-CN') : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(row.createdAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleCopy(row)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  复制地址
                                </DropdownMenuItem>
                                {explorerUrl && (
                                  <DropdownMenuItem onClick={() => window.open(explorerUrl, '_blank', 'noopener,noreferrer')}>
                                    浏览器查看
                                  </DropdownMenuItem>
                                )}
                                {row.state === 'available' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openDisable(row)} className="text-destructive">
                                      <Ban className="w-4 h-4 mr-2" />
                                      停用
                                    </DropdownMenuItem>
                                  </>
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
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title="生成充值地址"
        description="新地址进入地址池，按需分配给用户。由后端校验该网络是否支持系统生成。"
        confirmLabel="确认生成"
        confirmDisabled={!countValid}
        onConfirm={handleGenerate}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm">
            <span>网络</span>
            <Select value={generateNetwork} onValueChange={setGenerateNetwork}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {networkOptions.map((n) => (
                  <SelectItem key={n} value={n}>{networkLabel(n)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>数量（1-100）</span>
            <Input inputMode="numeric" value={generateCount} onChange={(e) => setGenerateCount(e.target.value)} />
          </label>
        </div>
        {!countValid && generateCount.trim() !== '' && <p className="text-xs text-negative">数量必须是 1-100 的整数</p>}
      </ConfirmDialog>

      <ConfirmDialog
        open={disableTarget !== null}
        onOpenChange={(open) => { if (!open) setDisableTarget(null); }}
        title="停用地址"
        description="仅未分配的地址可停用，停用后不再分配给用户。"
        details={disableTarget ? [
          { label: '网络', value: networkLabel(disableTarget.network) },
          { label: '地址', value: disableTarget.address, mono: true },
          ...(disableTarget.label ? [{ label: '标签', value: disableTarget.label }] : []),
        ] : []}
        confirmLabel="确认停用"
        destructive
        onConfirm={handleDisable}
      >
        <label className="grid gap-1.5 text-sm">
          <span>停用原因（可选）</span>
          <Input value={disableReason} maxLength={240} onChange={(e) => setDisableReason(e.target.value)} />
        </label>
      </ConfirmDialog>
    </AdminLayout>
  );
}
