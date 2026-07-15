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
import { Search, Filter, Eye, MoreHorizontal, Download, RefreshCw, CheckCircle, XCircle, Clock, ArrowRight, ArrowLeft, Wallet } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Collection {
  id: string;
  sourceWalletId: string;
  sourceAddress: string;
  destinationWalletId: string;
  destinationAddress: string;
  chain: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'tron' | 'solana';
  asset: string;
  amount: string;
  amountUsd: string;
  fee: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: 'threshold' | 'schedule' | 'manual';
  thresholdAmount?: string;
  txHash?: string;
  blockNumber?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
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

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  processing: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-mint/20 text-mint',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

const TRIGGER_LABELS: Record<string, string> = {
  threshold: '阈值触发',
  schedule: '定时触发',
  manual: '手动触发',
};

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [chainFilter, setChainFilter] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchCollections();
  }, [currentPage, pageSize, search, statusFilter, chainFilter, triggerFilter]);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(statusFilter && { status: statusFilter }),
        ...(chainFilter && { chain: chainFilter }),
        ...(triggerFilter && { triggeredBy: triggerFilter }),
      });

      const res = await fetch(`/api/admin/collections?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取归集记录失败');
      
      const data = await res.json();
      setCollections(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch collections:', err);
      // Fallback mock data
      setCollections([
        { id: '1', sourceWalletId: 'w1', sourceAddress: '0xuser1...abc', destinationWalletId: 'w_collect', destinationAddress: '0xcollect...999', chain: 'ethereum', asset: 'USDT', amount: '15,000', amountUsd: '$15,000', fee: '20', status: 'completed', triggeredBy: 'threshold', thresholdAmount: '10,000', txHash: '0xabc...def', blockNumber: '18900000', startedAt: '2024-12-01 10:00', completedAt: '2024-12-01 10:02' },
        { id: '2', sourceWalletId: 'w2', sourceAddress: '0xuser2...def', destinationWalletId: 'w_collect', destinationAddress: '0xcollect...999', chain: 'polygon', asset: 'USDC', amount: '50,000', amountUsd: '$50,000', fee: '5', status: 'processing', triggeredBy: 'manual', startedAt: '2024-12-01 11:00' },
        { id: '3', sourceWalletId: 'w3', sourceAddress: '0xuser3...ghi', destinationWalletId: 'w_collect', destinationAddress: '0xcollect...999', chain: 'bsc', asset: 'USDT', amount: '8,000', amountUsd: '$8,000', fee: '1', status: 'pending', triggeredBy: 'schedule', startedAt: '2024-12-01 12:00' },
        { id: '4', sourceWalletId: 'w4', sourceAddress: '0xuser4...jkl', destinationWalletId: 'w_collect', destinationAddress: '0xcollect...999', chain: 'arbitrum', asset: 'USDT', amount: '25,000', amountUsd: '$25,000', fee: '10', status: 'failed', triggeredBy: 'threshold', thresholdAmount: '20,000', startedAt: '2024-11-30 15:00', error: 'Gas 不足' },
        { id: '5', sourceWalletId: 'w5', sourceAddress: '0xuser5...mno', destinationWalletId: 'w_collect', destinationAddress: '0xcollect...999', chain: 'solana', asset: 'USDC', amount: '100,000', amountUsd: '$100,000', fee: '10', status: 'completed', triggeredBy: 'threshold', thresholdAmount: '50,000', txHash: 'SoL...777', startedAt: '2024-11-30 09:00', completedAt: '2024-11-30 09:05' },
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
    fetchCollections();
  };

  const handleAction = (action: string, collection: Collection) => {
    switch (action) {
      case 'view':
        window.open(`/collections/${collection.id}`, '_blank');
        break;
      case 'retry':
        if (confirm(`确定重试归集 ${collection.id} 吗？`)) {
          // TODO: API call
        }
        break;
      case 'cancel':
        if (confirm(`确定取消归集 ${collection.id} 吗？`)) {
          // TODO: API call
        }
        break;
      case 'export':
        // TODO: Export to CSV
        break;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">归集管理</h1>
            <p className="text-muted-foreground mt-1">自动/手动归集用户充值到运营钱包，减少碎片化</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchCollections()} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button variant="outline" onClick={() => handleAction('export', {} as Collection)} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              导出
            </Button>
            <Button className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              手动归集
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待处理</p>
                  <p className="text-2xl font-bold mt-1 text-amber-400">{collections.filter(c => c.status === 'pending').length}</p>
                </div>
                <Clock className="w-10 h-10 text-amber-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">处理中</p>
                  <p className="text-2xl font-bold mt-1 text-blue-400">{collections.filter(c => c.status === 'processing').length}</p>
                </div>
                <RefreshCw className="w-10 h-10 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已完成(24h)</p>
                  <p className="text-2xl font-bold mt-1 text-mint">{collections.filter(c => c.status === 'completed' && new Date(c.completedAt || '').toDateString() === new Date().toDateString()).length}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">失败</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{collections.filter(c => c.status === 'failed').length}</p>
                </div>
                <XCircle className="w-10 h-10 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">归集总额(USD)</p>
                  <p className="text-2xl font-bold mt-1 text-cyan-400">
                    {collections.filter(c => c.status === 'completed').reduce((sum, c) => sum + parseFloat(c.amountUsd.replace(/[$,]/g, '')), 0).toLocaleString()}
                  </p>
                </div>
                <ArrowRight className="w-10 h-10 text-cyan-400/50" />
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
                  placeholder="搜索源地址、目的地址、TXID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
              <Select value={chainFilter} onValueChange={setChainFilter}>
                <SelectTrigger className="w-full sm:w-32">
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
              <Select value={triggerFilter} onValueChange={setTriggerFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="触发方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="threshold">阈值触发</SelectItem>
                  <SelectItem value="schedule">定时触发</SelectItem>
                  <SelectItem value="manual">手动触发</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Collections Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>归集记录 (共 {totalCount} 条)</CardTitle>
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
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无归集记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>源地址</TableHead>
                      <TableHead>目的地址</TableHead>
                      <TableHead className="w-20">链</TableHead>
                      <TableHead className="w-32">资产/金额</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-28">触发方式</TableHead>
                      <TableHead className="w-32">时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.map((c) => (
                      <TableRow key={c.id} className="hover:bg-white/5">
                        <TableCell className="font-mono text-xs max-w-[160px] truncate">
                          {c.sourceAddress}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[160px] truncate">
                          {c.destinationAddress}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{CHAIN_LABELS[c.chain]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-mono tabular-nums font-medium">{c.amount} {c.asset}</p>
                            <p className="text-muted-foreground">{c.amountUsd}</p>
                            <p className="text-xs text-muted-foreground">手续费: {c.fee}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[c.status])}>
                            {STATUS_LABELS[c.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-500/20 text-blue-400">
                            {TRIGGER_LABELS[c.triggeredBy]}
                          </Badge>
                          {c.thresholdAmount && (
                            <p className="text-xs text-muted-foreground mt-1">阈值: {c.thresholdAmount}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <p>{new Date(c.startedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          {c.completedAt && (
                            <p className="text-xs text-mint">完成: {new Date(c.completedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                          )}
                          {c.error && (
                            <p className="text-xs text-red-400">错误: {c.error}</p>
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
                              <DropdownMenuItem onClick={() => handleAction('view', c)}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              {c.status === 'failed' && (
                                <DropdownMenuItem onClick={() => handleAction('retry', c)}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  重试
                                </DropdownMenuItem>
                              )}
                              {c.status === 'pending' && (
                                <DropdownMenuItem onClick={() => handleAction('cancel', c)} className="text-destructive">
                                  <XCircle className="w-4 h-4 mr-2" />
                                  取消
                                </DropdownMenuItem>
                              )}
                              {c.txHash && (
                                <DropdownMenuItem onClick={() => window.open(`/tx/${c.txHash}`, '_blank')}>
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