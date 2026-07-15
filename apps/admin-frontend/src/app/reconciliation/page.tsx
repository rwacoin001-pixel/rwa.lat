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
import { Search, Filter, Eye, Download, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, FileText, Scale, ArrowRight, ArrowLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Reconciliation {
  id: string;
  date: string;
  chain: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'tron' | 'solana';
  asset: string;
  onChainBalance: string;
  offChainBalance: string;
  difference: string;
  status: 'matched' | 'mismatch' | 'pending_review' | 'resolved';
  discrepancyType?: 'missing_deposits' | 'extra_withdrawals' | 'fee_mismatch' | 'timing_difference';
  discrepancyAmount?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  resolution?: string;
  txHashes?: string[];
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
  matched: '平账',
  mismatch: '不平账',
  pending_review: '待复核',
  resolved: '已处理',
};

const STATUS_STYLES: Record<string, string> = {
  matched: 'bg-mint/20 text-mint',
  mismatch: 'bg-red-500/20 text-red-400',
  pending_review: 'bg-amber-500/20 text-amber-400',
  resolved: 'bg-blue-500/20 text-blue-400',
};

const DISCREPANCY_LABELS: Record<string, string> = {
  missing_deposits: '缺失充值',
  extra_withdrawals: '额外提现',
  fee_mismatch: '手续费差异',
  timing_difference: '时间差',
};

export default function ReconciliationPage() {
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [chainFilter, setChainFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchReconciliations();
  }, [currentPage, pageSize, search, statusFilter, chainFilter]);

  const fetchReconciliations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(statusFilter && { status: statusFilter }),
        ...(chainFilter && { chain: chainFilter }),
      });

      const res = await fetch(`/api/admin/reconciliation?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取对账记录失败');
      
      const data = await res.json();
      setReconciliations(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch reconciliations:', err);
      // Fallback mock data
      setReconciliations([
        { id: '1', date: '2024-12-01', chain: 'ethereum', asset: 'USDT', onChainBalance: '1,000,000', offChainBalance: '1,000,000', difference: '0', status: 'matched' },
        { id: '2', date: '2024-12-01', chain: 'polygon', asset: 'USDC', onChainBalance: '500,000', offChainBalance: '500,020', difference: '+20', status: 'mismatch', discrepancyType: 'fee_mismatch', discrepancyAmount: '20', reviewedBy: 'admin1', reviewedAt: '2024-12-01 10:00', resolution: '手续费计算误差，已调整' },
        { id: '3', date: '2024-11-30', chain: 'bsc', asset: 'USDT', onChainBalance: '750,000', offChainBalance: '745,000', difference: '-5,000', status: 'pending_review', discrepancyType: 'missing_deposits', discrepancyAmount: '5,000' },
        { id: '4', date: '2024-11-30', chain: 'arbitrum', asset: 'USDT', onChainBalance: '300,000', offChainBalance: '300,000', difference: '0', status: 'matched' },
        { id: '5', date: '2024-11-29', chain: 'solana', asset: 'USDC', onChainBalance: '200,000', offChainBalance: '200,000', difference: '0', status: 'resolved', reviewedBy: 'admin2', reviewedAt: '2024-11-30 09:00', resolution: '时间差导致，已确认平账' },
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
    fetchReconciliations();
  };

  const handleAction = (action: string, rec: Reconciliation) => {
    switch (action) {
      case 'view':
        window.open(`/reconciliation/${rec.id}`, '_blank');
        break;
      case 'review':
        if (confirm(`确定复核对账记录 ${rec.id} 吗？`)) {
          // TODO: API call
        }
        break;
      case 'resolve':
        const resolution = prompt('请输入处理方案：');
        if (resolution) {
          // TODO: API call
        }
        break;
      case 'export':
        // TODO: Export to CSV
        break;
    }
  };

  const matchedCount = reconciliations.filter(r => r.status === 'matched').length;
  const mismatchCount = reconciliations.filter(r => r.status === 'mismatch' || r.status === 'pending_review').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">对账管理</h1>
            <p className="text-muted-foreground mt-1">链上余额 vs 数据库余额，自动检测差异并复核</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchReconciliations} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button variant="outline" onClick={() => handleAction('export', {} as Reconciliation)} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              导出
            </Button>
            <Button className="flex items-center gap-2">
              <Scale className="w-4 h-4" />
              手动对账
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">平账</p>
                  <p className="text-2xl font-bold mt-1 text-mint">{matchedCount}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">不平账/待复核</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{mismatchCount}</p>
                </div>
                <XCircle className="w-10 h-10 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总对账记录</p>
                  <p className="text-2xl font-bold mt-1">{totalCount}</p>
                </div>
                <FileText className="w-10 h-10 text-cyan-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">对账准确率</p>
                  <p className="text-2xl font-bold mt-1 text-mint">
                    {totalCount > 0 ? ((matchedCount / totalCount) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <Scale className="w-10 h-10 text-mint/50" />
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
                  placeholder="搜索日期、链、资产..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="对账状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="matched">平账</SelectItem>
                  <SelectItem value="mismatch">不平账</SelectItem>
                  <SelectItem value="pending_review">待复核</SelectItem>
                  <SelectItem value="resolved">已处理</SelectItem>
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
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Reconciliation Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>对账记录 (共 {totalCount} 条)</CardTitle>
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
            ) : reconciliations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Scale className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无对账记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">日期</TableHead>
                      <TableHead className="w-24">链</TableHead>
                      <TableHead className="w-20">资产</TableHead>
                      <TableHead className="w-32">链上余额</TableHead>
                      <TableHead className="w-32">数据库余额</TableHead>
                      <TableHead className="w-28">差异</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-32">差异类型</TableHead>
                      <TableHead className="w-32">复核信息</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliations.map((rec) => (
                      <TableRow key={rec.id} className="hover:bg-white/5">
                        <TableCell className="font-medium">
                          {new Date(rec.date).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{CHAIN_LABELS[rec.chain]}</Badge>
                        </TableCell>
                        <TableCell className="font-mono font-medium">{rec.asset}</TableCell>
                        <TableCell className="font-mono tabular-nums">{rec.onChainBalance}</TableCell>
                        <TableCell className="font-mono tabular-nums">{rec.offChainBalance}</TableCell>
                        <TableCell>
                          <span className={cn('font-mono tabular-nums font-medium', parseFloat(rec.difference) === 0 ? 'text-mint' : parseFloat(rec.difference) > 0 ? 'text-amber-400' : 'text-red-400')}>
                            {rec.difference}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[rec.status])}>
                            {STATUS_LABELS[rec.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rec.discrepancyType ? (
                            <Badge variant="outline" className="bg-amber-500/20 text-amber-400">
                              {DISCREPANCY_LABELS[rec.discrepancyType]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rec.reviewedBy ? (
                            <div className="text-xs">
                              <p className="text-muted-foreground">复核人: {rec.reviewedBy}</p>
                              <p>{rec.reviewedAt && new Date(rec.reviewedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                              {rec.resolution && (
                                <p className="text-mint mt-1 max-w-[120px] truncate">{rec.resolution}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
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
                              <DropdownMenuItem onClick={() => handleAction('view', rec)}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              {rec.status === 'pending_review' && (
                                <DropdownMenuItem onClick={() => handleAction('review', rec)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  复核
                                </DropdownMenuItem>
                              )}
                              {rec.status === 'mismatch' && (
                                <DropdownMenuItem onClick={() => handleAction('resolve', rec)}>
                                  <AlertTriangle className="w-4 h-4 mr-2" />
                                  处理差异
                                </DropdownMenuItem>
                              )}
                              {rec.txHashes && rec.txHashes.length > 0 && (
                                <DropdownMenuItem onClick={() => window.open(`/tx/${rec.txHashes![0]}`, '_blank')}>
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