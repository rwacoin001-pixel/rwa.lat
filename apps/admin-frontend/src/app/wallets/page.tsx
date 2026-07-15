'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, Eye, Edit, MoreHorizontal, Wallet, Send, ArrowDownToLine, Activity, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Wallet {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  chain: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'tron' | 'solana';
  address: string;
  type: 'deposit' | 'withdrawal' | 'collection' | 'operational';
  status: 'active' | 'frozen' | 'pending' | 'archived';
  balance: string;
  usdValue: string;
  lastActivityAt: string;
  createdAt: string;
}

const CHAIN_LABELS: Record<string, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  bsc: 'BSC',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  tron: 'TRON',
  solana: 'Solana',
};

const TYPE_LABELS: Record<string, string> = {
  deposit: '充值钱包',
  withdrawal: '提现钱包',
  collection: '归集钱包',
  operational: '运营钱包',
};

const TYPE_STYLES: Record<string, string> = {
  deposit: 'bg-blue-500/20 text-blue-400',
  withdrawal: 'bg-purple-500/20 text-purple-400',
  collection: 'bg-cyan-500/20 text-cyan-400',
  operational: 'bg-amber-500/20 text-amber-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: '正常',
  frozen: '冻结',
  pending: '待激活',
  archived: '已归档',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-mint/20 text-mint',
  frozen: 'bg-red-500/20 text-red-400',
  pending: 'bg-amber-500/20 text-amber-400',
  archived: 'bg-gray-500/20 text-gray-400',
};

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chainFilter, setChainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchWallets();
  }, [currentPage, pageSize, search, chainFilter, typeFilter, statusFilter]);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(chainFilter && { chain: chainFilter }),
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/admin/wallets?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取钱包列表失败');
      
      const data = await res.json();
      setWallets(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch wallets:', err);
      // Fallback mock data
      setWallets([
        { id: '1', userId: 'u1', userName: '张三', userEmail: 'zhang@example.com', chain: 'ethereum', address: '0x1234...5678', type: 'deposit', status: 'active', balance: '1,250.50', usdValue: '$2,450,000', lastActivityAt: '2024-12-01', createdAt: '2024-01-15' },
        { id: '2', userId: 'u2', userName: '李四', userEmail: 'li@example.com', chain: 'polygon', address: '0xabcd...efgh', type: 'withdrawal', status: 'active', balance: '500.00', usdValue: '$980,000', lastActivityAt: '2024-11-30', createdAt: '2024-02-20' },
        { id: '3', userId: 'u3', userName: '系统归集', userEmail: 'system@rwa.lat', chain: 'bsc', address: '0x9999...0000', type: 'collection', status: 'active', balance: '10,000.00', usdValue: '$19,600,000', lastActivityAt: '2024-12-01', createdAt: '2024-01-10' },
        { id: '4', userId: 'u4', userName: '风控账户', userEmail: 'risk@rwa.lat', chain: 'arbitrum', address: '0x5555...7777', type: 'operational', status: 'frozen', balance: '0.00', usdValue: '$0', lastActivityAt: '2024-11-15', createdAt: '2024-03-01' },
        { id: '5', userId: 'u5', userName: '王五', userEmail: 'wang@example.com', chain: 'solana', address: 'SoL...9999', type: 'deposit', status: 'pending', balance: '0.00', usdValue: '$0', lastActivityAt: '—', createdAt: '2024-11-28' },
      ]);
      setTotalCount(5);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchWallets();
  };

  const handleAction = (action: string, wallet: Wallet) => {
    switch (action) {
      case 'view':
        window.open(`/wallets/${wallet.id}`, '_blank');
        break;
      case 'edit':
        // TODO: Open edit modal
        break;
      case 'freeze':
        if (confirm(`确定要冻结钱包 ${wallet.address.slice(0, 10)}... 吗？`)) {
          // TODO: API call
        }
        break;
      case 'unfreeze':
        if (confirm(`确定要解冻钱包 ${wallet.address.slice(0, 10)}... 吗？`)) {
          // TODO: API call
        }
        break;
      case 'transfer':
        window.open(`/wallets/${wallet.id}/transfer`, '_blank');
        break;
      case 'archive':
        if (confirm(`确定要归档钱包 ${wallet.address.slice(0, 10)}... 吗？`)) {
          // TODO: API call
        }
        break;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">钱包管理</h1>
            <p className="text-muted-foreground mt-1">充值、提现、归集、运营钱包全生命周期管理</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentPage(1)} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              新建钱包
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总钱包数</p>
                  <p className="text-2xl font-bold mt-1">{totalCount}</p>
                </div>
                <Wallet className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">活跃钱包</p>
                  <p className="text-2xl font-bold mt-1 text-mint">{wallets.filter(w => w.status === 'active').length}</p>
                </div>
                <Activity className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">冻结钱包</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{wallets.filter(w => w.status === 'frozen').length}</p>
                </div>
                <Wallet className="w-10 h-10 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待激活</p>
                  <p className="text-2xl font-bold mt-1 text-amber-400">{wallets.filter(w => w.status === 'pending').length}</p>
                </div>
                <Activity className="w-10 h-10 text-amber-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总资产(USD)</p>
                  <p className="text-2xl font-bold mt-1">
                    {wallets.reduce((sum, w) => sum + parseFloat(w.usdValue.replace(/[$,]/g, '')), 0).toLocaleString()}
                  </p>
                </div>
                <Send className="w-10 h-10 text-cyan-400/50" />
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
                  placeholder="搜索地址、用户、邮箱..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={chainFilter} onValueChange={setChainFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="链" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="bsc">BSC</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                  <SelectItem value="optimism">Optimism</SelectItem>
                  <SelectItem value="tron">TRON</SelectItem>
                  <SelectItem value="solana">Solana</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="deposit">充值钱包</SelectItem>
                  <SelectItem value="withdrawal">提现钱包</SelectItem>
                  <SelectItem value="collection">归集钱包</SelectItem>
                  <SelectItem value="operational">运营钱包</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="frozen">冻结</SelectItem>
                  <SelectItem value="pending">待激活</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Wallets Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>钱包列表 (共 {totalCount} 条)</CardTitle>
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
            ) : wallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无钱包数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">链</TableHead>
                      <TableHead>地址</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead className="w-32">类型</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-36">余额</TableHead>
                      <TableHead className="w-36">USD 价值</TableHead>
                      <TableHead className="w-32">最后活动</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallets.map((w) => (
                      <TableRow key={w.id} className="hover:bg-white/5">
                        <TableCell>
                          <Badge variant="outline">{CHAIN_LABELS[w.chain]}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {w.address}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{w.userName}</p>
                            <p className="text-sm text-muted-foreground">{w.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(TYPE_STYLES[w.type])}>
                            {TYPE_LABELS[w.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[w.status])}>
                            {STATUS_LABELS[w.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{w.balance}</TableCell>
                        <TableCell className="font-mono tabular-nums text-cyan-400">{w.usdValue}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {w.lastActivityAt === '—' ? '—' : new Date(w.lastActivityAt).toLocaleDateString('zh-CN')}
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
                              <DropdownMenuItem onClick={() => handleAction('edit', w)}>
                                <Edit className="w-4 h-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('transfer', w)}>
                                <Send className="w-4 h-4 mr-2" />
                                转账
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {w.status === 'active' && (
                                <DropdownMenuItem onClick={() => handleAction('freeze', w)} className="text-amber-400">
                                  冻结钱包
                                </DropdownMenuItem>
                              )}
                              {w.status === 'frozen' && (
                                <DropdownMenuItem onClick={() => handleAction('unfreeze', w)} className="text-mint">
                                  解冻钱包
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleAction('archive', w)} className="text-destructive">
                                归档钱包
                              </DropdownMenuItem>
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
              <div className="px-4 py-4 border-t border-white/10">
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