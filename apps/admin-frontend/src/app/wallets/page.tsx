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
import { Search, Filter, MoreHorizontal, Wallet, Copy, Ban, Activity, RefreshCw, KeyRound, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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

const EXPLORERS: Record<string, string> = {
  tron: 'https://tronscan.org/#/address/',
};

export default function WalletsPage() {
  const [addresses, setAddresses] = useState<PoolAddress[]>([]);
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPool();
  }, []);

  const fetchPool = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/wallet/deposit-pool?limit=200', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `获取地址池失败 (HTTP ${res.status})`);
      }
      const data = await res.json();
      setAddresses(data.addresses || []);
      setStats((data.stats?.networks || [])[0] ?? null);
    } catch (err) {
      setAddresses([]);
      setStats(null);
      setError(err instanceof Error ? err.message : '获取地址池失败');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return addresses.filter((row) => {
      if (stateFilter && row.state !== stateFilter) return false;
      if (!keyword) return true;
      return (
        row.address.toLowerCase().includes(keyword) ||
        (row.assignedUserId || '').toLowerCase().includes(keyword) ||
        (row.label || '').toLowerCase().includes(keyword)
      );
    });
  }, [addresses, search, stateFilter]);

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

  const handleGenerate = async () => {
    const input = prompt('生成数量 (1-100)：', '20');
    if (!input) return;
    const count = Number(input);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      alert('数量必须是 1-100 的整数');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/wallet/deposit-pool/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ network: 'tron', count }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `生成失败 (HTTP ${res.status})`);
      alert(`已生成 ${body?.generated ?? count} 个地址`);
      await fetchPool();
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async (row: PoolAddress) => {
    if (!confirm(`确定停用地址 ${row.address.slice(0, 12)}... 吗？仅未分配的地址可停用。`)) return;
    const reason = prompt('停用原因（可选）：') || undefined;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/wallet/deposit-pool/${row.id}/disable`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `停用失败 (HTTP ${res.status})`);
      await fetchPool();
    } catch (err) {
      alert(err instanceof Error ? err.message : '停用失败');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (row: PoolAddress) => {
    try {
      await navigator.clipboard.writeText(row.address);
      alert('地址已复制');
    } catch {
      alert(row.address);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">入金地址池</h1>
            <p className="text-muted-foreground mt-1">手动托管模式：按用户分配专属 TRON USDT 充值地址（地址与私钥加密存储）</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setCurrentPage(1); fetchPool(); }} disabled={busy} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button className="flex items-center gap-2" onClick={handleGenerate} disabled={busy}>
              <Plus className="w-4 h-4" />
              生成地址
            </Button>
          </div>
        </div>

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
                  <p className="text-sm text-muted-foreground">总地址数</p>
                  <p className="text-2xl font-bold mt-1">{addresses.length}</p>
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
                  <p className="text-2xl font-bold mt-1 text-mint">{stats?.available ?? 0}</p>
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
                  <p className="text-2xl font-bold mt-1 text-blue-600">{stats?.assigned ?? 0}</p>
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
                  <p className="text-2xl font-bold mt-1 text-slate-500">{stats?.disabled ?? 0}</p>
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
                  <p className="text-2xl font-bold mt-1">{stats?.keyHeld ?? 0}</p>
                  {stats && stats.keyMissing > 0 && (
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
              <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
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
            <CardTitle>地址列表 (共 {totalCount} 条)</CardTitle>
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
                <p>{addresses.length === 0 ? '地址池为空，点击右上角「生成地址」开始' : '没有符合筛选条件的地址'}</p>
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
                    {paged.map((row) => (
                      <TableRow key={row.id} className="hover:bg-ink/[0.05]">
                        <TableCell>
                          <Badge variant="outline">TRON</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <button
                            className="text-left hover:text-mint"
                            title="点击复制"
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
                            {STATE_LABELS[row.state]}
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
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleCopy(row)}>
                                <Copy className="w-4 h-4 mr-2" />
                                复制地址
                              </DropdownMenuItem>
                              {EXPLORERS[row.network] && (
                                <DropdownMenuItem onClick={() => window.open(`${EXPLORERS[row.network]}${row.address}`, '_blank')}>
                                  浏览器查看
                                </DropdownMenuItem>
                              )}
                              {row.state === 'available' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDisable(row)} className="text-destructive">
                                    <Ban className="w-4 h-4 mr-2" />
                                    停用
                                  </DropdownMenuItem>
                                </>
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
