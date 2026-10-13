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
import { Search, Filter, MoreHorizontal, Wallet, Copy, Ban, Activity, RefreshCw, KeyRound, Upload, History } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cn } from '@/lib/utils';
import { addressExplorerUrl, networkLabel, WALLET_NETWORKS } from '@/lib/chains';

interface PoolAddress {
  id: string;
  network: string;
  address: string;
  state: 'available' | 'assigned' | 'retired' | 'disabled';
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
  retiredAt?: string | null;
  watchUntil?: string | null;
}

interface PoolStats {
  network: string;
  available: number;
  assigned: number;
  retired?: number;
  disabled: number;
  keyHeld: number;
  keyMissing: number;
}

const ALL = 'all';
// Backend list endpoint caps at 200 rows and has no offset/cursor.
const LIST_LIMIT = 200;

const STATE_LABELS: Record<string, string> = {
  available: '可用',
  assigned: '使用中',
  retired: '已轮换',
  disabled: '已停用',
};

// Below this many unassigned addresses the operator should upload more.
const LOW_STOCK = 20;
const MAX_UPLOAD = 1000;

type UploadRejection = { line: number; address: string; reason: 'invalid_address' | 'duplicate_in_upload' | 'already_in_pool' };
const REJECTION_LABELS: Record<UploadRejection['reason'], string> = {
  invalid_address: '格式无效',
  duplicate_in_upload: '本次重复',
  already_in_pool: '已在地址池',
};

/** One address per line; commas, semicolons and spaces also separate. A CSV's first column is used. */
function parseAddresses(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/[,;\t ]+/)[0]?.trim() ?? '')
    .filter((value) => value && !/^address$/i.test(value));
}

const STATE_STYLES: Record<string, string> = {
  available: 'bg-mint/20 text-mint',
  assigned: 'bg-blue-500/20 text-blue-600',
  retired: 'bg-amber-500/15 text-amber-700',
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadLabel, setUploadLabel] = useState('');
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
        retired: acc.retired + (s.retired ?? 0),
        disabled: acc.disabled + s.disabled,
        keyHeld: acc.keyHeld + s.keyHeld,
        keyMissing: acc.keyMissing + s.keyMissing,
      }),
      { available: 0, assigned: 0, retired: 0, disabled: 0, keyHeld: 0, keyMissing: 0 },
    );
  }, [networkStats, networkFilter]);
  const totalAddresses = stats.available + stats.assigned + stats.retired + stats.disabled;
  const lowStock = !loading && !error && stats.available < LOW_STOCK;

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

  const uploadAddresses = useMemo(() => parseAddresses(uploadText), [uploadText]);
  const uploadValid = uploadAddresses.length > 0 && uploadAddresses.length <= MAX_UPLOAD;

  const openUpload = () => {
    setNotice(null);
    setUploadText('');
    setUploadLabel('');
    setUploadOpen(true);
  };

  const loadUploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadText(await file.text());
  };

  const handleUpload = async () => {
    if (!uploadValid) throw new Error(`请粘贴 1-${MAX_UPLOAD} 个地址`);
    setBusy(true);
    try {
      const label = uploadLabel.trim();
      const res = await fetch('/api/admin/wallet/deposit-pool/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ network: 'tron', addresses: uploadAddresses, ...(label ? { label } : {}) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `上传失败 (HTTP ${res.status})`);
      const rejected: UploadRejection[] = Array.isArray(body?.rejected) ? body.rejected : [];
      const summary = rejected.slice(0, 8).map((r) => `第 ${r.line} 行 ${r.address.slice(0, 12)}… ${REJECTION_LABELS[r.reason] ?? r.reason}`).join('；');
      setNotice({
        kind: rejected.length ? 'error' : 'ok',
        text: `已上传 ${body?.imported ?? 0} 个地址` + (rejected.length ? `，${rejected.length} 行未导入：${summary}${rejected.length > 8 ? ' …' : ''}` : ''),
      });
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
            <Button className="flex items-center gap-2" onClick={openUpload} disabled={busy}>
              <Upload className="w-4 h-4" />
              上传地址
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
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
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
                  <p className="text-sm text-muted-foreground">待分配</p>
                  <p className={cn('text-2xl font-bold mt-1', lowStock ? 'text-amber-600' : 'text-mint')}>{stats.available}</p>
                  {lowStock && <p className="text-xs text-amber-600 mt-1">库存不足 {LOW_STOCK}，请上传</p>}
                </div>
                <Activity className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">使用中</p>
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
                  <p className="text-sm text-muted-foreground">已轮换</p>
                  <p className="text-2xl font-bold mt-1 text-amber-700">{stats.retired}</p>
                  <p className="text-xs text-muted-foreground mt-1">仍归原用户并持续监听</p>
                </div>
                <History className="w-10 h-10 text-amber-600/40" />
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
                  <p className="text-sm text-muted-foreground">私钥由你保管</p>
                  <p className="text-2xl font-bold mt-1">{stats.keyMissing}</p>
                  {stats.keyHeld > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">另有 {stats.keyHeld} 个旧版系统生成地址</p>
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
                  <SelectItem value="available">待分配</SelectItem>
                  <SelectItem value="assigned">使用中</SelectItem>
                  <SelectItem value="retired">已轮换</SelectItem>
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
                <p>{totalAddresses === 0 && networkFilter === ALL ? '地址池为空，点击右上角「上传地址」开始' : '没有符合筛选条件的地址'}</p>
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
                              {row.source === 'generated' ? '系统生成' : '上传'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(STATE_STYLES[row.state])}>
                              {STATE_LABELS[row.state] ?? row.state}
                            </Badge>
                            {row.watchUntil && new Date(row.watchUntil).getTime() > Date.now() && (
                              <p className="text-xs text-mint mt-1">监听中</p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.keyHeld ? (
                              <span className="text-muted-foreground">系统托管（旧）</span>
                            ) : (
                              <span>你保管</span>
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
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title="上传充值地址"
        description="只上传地址，不上传私钥。按上传顺序分配给用户；地址收到充值后，该用户下次充值会换用下一个地址，旧地址仍归该用户并持续监听。"
        details={[
          { label: '网络', value: 'TRON (TRC-20 USDT)' },
          { label: '识别到', value: `${uploadAddresses.length} 个地址`, emphasis: true },
        ]}
        confirmLabel="确认上传"
        confirmDisabled={!uploadValid}
        onConfirm={handleUpload}
      >
        <label className="grid gap-1.5 text-sm">
          <span>地址（每行一个，或选择 .txt / .csv 文件）</span>
          <textarea
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'T...\nT...'}
            className="w-full rounded-input border border-ink/[0.14] bg-white/70 px-3 py-2 font-mono text-xs text-ink shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-mint focus:border-transparent focus:bg-white"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={(e) => void loadUploadFile(e.target.files?.[0])} className="text-xs" />
          {uploadAddresses.length > MAX_UPLOAD && <span className="text-xs text-negative">单次最多 {MAX_UPLOAD} 个</span>}
        </div>
        <label className="grid gap-1.5 text-sm">
          <span>批次备注（可选）</span>
          <Input value={uploadLabel} maxLength={120} onChange={(e) => setUploadLabel(e.target.value)} placeholder="例如：2026-10 第一批" />
        </label>
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
