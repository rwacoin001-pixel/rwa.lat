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
import { Search, Filter, Eye, Download, RefreshCw, ArrowRight, ArrowLeft, DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface LedgerEntry {
  id: string;
  txId: string;
  userId: string;
  userName: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'fee' | 'reward' | 'penalty' | 'adjustment';
  asset: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  chain?: string;
  txHash?: string;
  status: 'pending' | 'confirmed' | 'failed';
  relatedOrderId?: string;
  notes?: string;
  createdAt: string;
  confirmedAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: '充值',
  withdrawal: '提现',
  trade: '交易',
  fee: '手续费',
  reward: '奖励',
  penalty: '罚金',
  adjustment: '调整',
};

const TYPE_STYLES: Record<string, string> = {
  deposit: 'bg-mint/20 text-mint',
  withdrawal: 'bg-red-500/20 text-red-400',
  trade: 'bg-blue-500/20 text-blue-400',
  fee: 'bg-amber-500/20 text-amber-400',
  reward: 'bg-purple-500/20 text-purple-400',
  penalty: 'bg-red-500/20 text-red-400',
  adjustment: 'bg-gray-500/20 text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  failed: '失败',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  confirmed: 'bg-mint/20 text-mint',
  failed: 'bg-red-500/20 text-red-400',
};

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchLedger();
  }, [currentPage, pageSize, search, typeFilter, statusFilter, assetFilter]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(assetFilter && { asset: assetFilter }),
      });

      const res = await fetch(`/api/admin/ledger?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取账本失败');
      
      const data = await res.json();
      setEntries(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
      // Fallback mock data
      setEntries([
        { id: '1', txId: 'tx_001', userId: 'u1', userName: '张三', type: 'deposit', asset: 'USDT', amount: '+50,000', balanceBefore: '0', balanceAfter: '50,000', chain: 'ethereum', txHash: '0xabc...def', status: 'confirmed', createdAt: '2024-12-01 10:00', confirmedAt: '2024-12-01 10:02' },
        { id: '2', txId: 'tx_002', userId: 'u2', userName: '李四', type: 'withdrawal', asset: 'USDT', amount: '-100,000', balanceBefore: '150,000', balanceAfter: '50,000', chain: 'polygon', txHash: '0x123...456', status: 'confirmed', createdAt: '2024-12-01 09:30', confirmedAt: '2024-12-01 09:32' },
        { id: '3', txId: 'tx_003', userId: 'u3', userName: '王五', type: 'trade', asset: 'USDC', amount: '-25,000', balanceBefore: '100,000', balanceAfter: '75,000', relatedOrderId: 'order_123', status: 'confirmed', createdAt: '2024-11-30 15:00', confirmedAt: '2024-11-30 15:00' },
        { id: '4', txId: 'tx_004', userId: 'u1', userName: '张三', type: 'fee', asset: 'USDT', amount: '-20', balanceBefore: '50,000', balanceAfter: '49,980', status: 'confirmed', createdAt: '2024-11-30 10:00', confirmedAt: '2024-11-30 10:00' },
        { id: '5', txId: 'tx_005', userId: 'u4', userName: '赵六', type: 'deposit', asset: 'USDT', amount: '+500,000', balanceBefore: '0', balanceAfter: '500,000', chain: 'bsc', txHash: '0x999...000', status: 'pending', createdAt: '2024-12-01 11:00' },
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
    fetchLedger();
  };

  const handleExport = () => {
    // TODO: Export to CSV
    alert('导出功能开发中...');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">账本明细</h1>
            <p className="text-muted-foreground mt-1">所有用户资产变动流水，不可篡改的审计日志</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchLedger} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              导出 CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日入账(USD)</p>
                  <p className="text-2xl font-bold mt-1 text-mint">
                    {entries.filter(e => e.type === 'deposit' && new Date(e.createdAt).toDateString() === new Date().toDateString()).reduce((sum, e) => sum + Math.abs(parseFloat(e.amount)), 0).toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日出账(USD)</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">
                    {entries.filter(e => ['withdrawal', 'fee'].includes(e.type) && new Date(e.createdAt).toDateString() === new Date().toDateString()).reduce((sum, e) => sum + Math.abs(parseFloat(e.amount)), 0).toLocaleString()}
                  </p>
                </div>
                <TrendingDown className="w-10 h-10 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待确认交易</p>
                  <p className="text-2xl font-bold mt-1 text-amber-400">{entries.filter(e => e.status === 'pending').length}</p>
                </div>
                <Clock className="w-10 h-10 text-amber-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总记录数</p>
                  <p className="text-2xl font-bold mt-1">{totalCount.toLocaleString()}</p>
                </div>
                <DollarSign className="w-10 h-10 text-cyan-400/50" />
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
                  placeholder="搜索用户、TXID、交易哈希..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="deposit">充值</SelectItem>
                  <SelectItem value="withdrawal">提现</SelectItem>
                  <SelectItem value="trade">交易</SelectItem>
                  <SelectItem value="fee">手续费</SelectItem>
                  <SelectItem value="reward">奖励</SelectItem>
                  <SelectItem value="penalty">罚金</SelectItem>
                  <SelectItem value="adjustment">调整</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="pending">待确认</SelectItem>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assetFilter} onValueChange={setAssetFilter}>
                <SelectTrigger className="w-full sm:w-28">
                  <SelectValue placeholder="资产" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Ledger Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>账本流水 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">每页</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <DollarSign className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无账本记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead className="w-24">类型</TableHead>
                      <TableHead className="w-32">资产/金额</TableHead>
                      <TableHead className="w-36">余额变动</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-32">链/TX Hash</TableHead>
                      <TableHead className="w-32">时间</TableHead>
                      <TableHead className="w-16">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id} className="hover:bg-white/5">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {entry.txId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.userName}</p>
                            <p className="text-sm text-muted-foreground">{entry.userId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(TYPE_STYLES[entry.type])}>
                            {TYPE_LABELS[entry.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className={cn('font-mono tabular-nums font-medium', parseFloat(entry.amount) > 0 ? 'text-mint' : 'text-red-400')}>
                              {entry.amount} {entry.asset}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="text-muted-foreground">前: {entry.balanceBefore}</p>
                            <p>后: {entry.balanceAfter}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[entry.status])}>
                            {STATUS_LABELS[entry.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {entry.chain && (
                            <Badge variant="outline" className="mb-1">{entry.chain}</Badge>
                          )}
                          {entry.txHash && (
                            <p className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                              {entry.txHash}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <p>{new Date(entry.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          {entry.confirmedAt && (
                            <p className="text-xs text-mint">确认: {new Date(entry.confirmedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/ledger/${entry.id}`, '_blank')}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              {entry.txHash && (
                                <DropdownMenuItem onClick={() => window.open(`/tx/${entry.txHash}`, '_blank')}>
                                  查看链上交易
                                </DropdownMenuItem>
                              )}
                              {entry.relatedOrderId && (
                                <DropdownMenuItem onClick={() => window.open(`/orders/${entry.relatedOrderId}`, '_blank')}>
                                  查看关联订单
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