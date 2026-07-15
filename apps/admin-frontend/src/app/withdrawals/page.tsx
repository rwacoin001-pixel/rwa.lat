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
import { Search, Filter, Eye, MoreHorizontal, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, ArrowRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  chain: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'tron' | 'solana';
  asset: string;
  amount: string;
  amountUsd: string;
  fee: string;
  feeUsd: string;
  destinationAddress: string;
  destinationTag?: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'normal' | 'high' | 'urgent';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  completedAt?: string;
  txHash?: string;
  rejectionReason?: string;
  requiresDualApproval: boolean;
  approver1?: string;
  approver2?: string;
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
  reviewing: '审核中',
  approved: '已批准',
  rejected: '已拒绝',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  reviewing: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-mint/20 text-mint',
  rejected: 'bg-red-500/20 text-red-400',
  processing: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-mint/20 text-mint',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  normal: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

const RISK_STYLES: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [chainFilter, setChainFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchWithdrawals();
  }, [currentPage, pageSize, search, statusFilter, priorityFilter, riskFilter, chainFilter]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
        ...(riskFilter && { riskLevel: riskFilter }),
        ...(chainFilter && { chain: chainFilter }),
      });

      const res = await fetch(`/api/admin/withdrawals?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取提现列表失败');
      
      const data = await res.json();
      setWithdrawals(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
      // Fallback mock data
      setWithdrawals([
        { id: '1', userId: 'u1', userName: '张三', userEmail: 'zhang@example.com', chain: 'ethereum', asset: 'USDT', amount: '50,000', amountUsd: '$50,000', fee: '20', feeUsd: '$20', destinationAddress: '0xabcd...1234', status: 'pending', priority: 'high', riskLevel: 'medium', requestedAt: '2024-12-01 10:30', requiresDualApproval: true },
        { id: '2', userId: 'u2', userName: '李四', userEmail: 'li@example.com', chain: 'polygon', asset: 'USDC', amount: '100,000', amountUsd: '$100,000', fee: '5', feeUsd: '$5', destinationAddress: '0x5678...9012', status: 'reviewing', priority: 'urgent', riskLevel: 'high', requestedAt: '2024-12-01 09:15', reviewedAt: '2024-12-01 09:20', reviewedBy: 'admin1', requiresDualApproval: true, approver1: 'admin1' },
        { id: '3', userId: 'u3', userName: '王五', userEmail: 'wang@example.com', chain: 'bsc', asset: 'USDT', amount: '10,000', amountUsd: '$10,000', fee: '1', feeUsd: '$1', destinationAddress: '0x9999...0000', status: 'approved', priority: 'normal', riskLevel: 'low', requestedAt: '2024-11-30 15:00', reviewedAt: '2024-11-30 15:05', reviewedBy: 'admin2', completedAt: '2024-11-30 15:10', txHash: '0xabc...def', requiresDualApproval: false },
        { id: '4', userId: 'u4', userName: '赵六', userEmail: 'zhao@example.com', chain: 'arbitrum', asset: 'USDT', amount: '500,000', amountUsd: '$500,000', fee: '50', feeUsd: '$50', destinationAddress: '0x1111...2222', status: 'rejected', priority: 'urgent', riskLevel: 'critical', requestedAt: '2024-11-29 14:00', reviewedAt: '2024-11-29 14:30', reviewedBy: 'admin1', rejectionReason: '风控模型命中洗钱模式', requiresDualApproval: true },
        { id: '5', userId: 'u5', userName: '钱七', userEmail: 'qian@example.com', chain: 'solana', asset: 'USDC', amount: '25,000', amountUsd: '$25,000', fee: '10', feeUsd: '$10', destinationAddress: 'SoL...3333', status: 'completed', priority: 'normal', riskLevel: 'low', requestedAt: '2024-11-28 11:00', reviewedAt: '2024-11-28 11:05', reviewedBy: 'admin2', completedAt: '2024-11-28 11:10', txHash: 'SoLTx...777', requiresDualApproval: false },
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
    fetchWithdrawals();
  };

  const handleAction = (action: string, withdrawal: Withdrawal) => {
    switch (action) {
      case 'view':
        window.open(`/withdrawals/${withdrawal.id}`, '_blank');
        break;
      case 'approve':
        if (confirm(`确定批准提现 ${withdrawal.id} 吗？`)) {
          // TODO: API call
        }
        break;
      case 'reject': {
        const reason = prompt('请输入拒绝原因：');
        if (reason) {
          // TODO: API call
        }
        break;
      }
      case 'process':
        if (confirm(`确定开始处理提现 ${withdrawal.id} 吗？`)) {
          // TODO: API call
        }
        break;
      case 'escalate':
        if (confirm(`确定升级处理提现 ${withdrawal.id} 吗？`)) {
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
            <h1 className="text-3xl font-bold tracking-tight">提现审批</h1>
            <p className="text-muted-foreground mt-1">大额提现双人审批、风控拦截、链上广播全流程</p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => setCurrentPage(1)}>
            <Clock className="w-4 h-4" />
            刷新
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待处理</p>
                  <p className="text-2xl font-bold mt-1 text-amber-400">{withdrawals.filter(w => w.status === 'pending').length}</p>
                </div>
                <Clock className="w-10 h-10 text-amber-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">审核中</p>
                  <p className="text-2xl font-bold mt-1 text-blue-400">{withdrawals.filter(w => w.status === 'reviewing').length}</p>
                </div>
                <Clock className="w-10 h-10 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">紧急优先级</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{withdrawals.filter(w => w.priority === 'urgent').length}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">需双人审批</p>
                  <p className="text-2xl font-bold mt-1 text-purple-400">{withdrawals.filter(w => w.requiresDualApproval).length}</p>
                </div>
                <DollarSign className="w-10 h-10 text-purple-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日金额(USD)</p>
                  <p className="text-2xl font-bold mt-1 text-cyan-400">
                    {withdrawals.filter(w => new Date(w.requestedAt).toDateString() === new Date().toDateString()).reduce((sum, w) => sum + parseFloat(w.amountUsd.replace(/[$,]/g, '')), 0).toLocaleString()}
                  </p>
                </div>
                <ArrowRight className="w-10 h-10 text-cyan-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">高风险拦截</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{withdrawals.filter(w => w.riskLevel === 'critical' || w.riskLevel === 'high').length}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-400/50" />
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
                  placeholder="搜索用户、地址、TXID..."
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
                  <SelectItem value="reviewing">审核中</SelectItem>
                  <SelectItem value="approved">已批准</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-28">
                  <SelectValue placeholder="优先级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-full sm:w-28">
                  <SelectValue placeholder="风险等级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="critical">极高</SelectItem>
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
            ) : withdrawals.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <DollarSign className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无提现记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead className="w-20">链</TableHead>
                      <TableHead className="w-24">资产/金额</TableHead>
                      <TableHead className="w-28">目的地址</TableHead>
                      <TableHead className="w-24">优先级</TableHead>
                      <TableHead className="w-24">风险</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-32">时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => (
                      <TableRow key={w.id} className="hover:bg-white/5">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {w.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{w.userName}</p>
                            <p className="text-sm text-muted-foreground">{w.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{CHAIN_LABELS[w.chain]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-mono tabular-nums font-medium">{w.amount} {w.asset}</p>
                            <p className="text-muted-foreground">{w.amountUsd}</p>
                            <p className="text-xs text-muted-foreground">手续费: {w.fee} ({w.feeUsd})</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[160px] truncate">
                          {w.destinationAddress}
                          {w.destinationTag && <span className="text-muted-foreground ml-1">Tag: {w.destinationTag}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(PRIORITY_STYLES[w.priority])}>
                            {PRIORITY_LABELS[w.priority]}
                          </Badge>
                          {w.requiresDualApproval && (
                            <span className="ml-1 inline-flex items-center gap-1 text-xs text-purple-400">
                              <span className="w-2 h-2 rounded-full bg-purple-400" />
                              双审
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(RISK_STYLES[w.riskLevel])}>
                            {w.riskLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[w.status])}>
                            {STATUS_LABELS[w.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <p>{new Date(w.requestedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          {w.reviewedAt && (
                            <p className="text-xs text-blue-400">审核: {new Date(w.reviewedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                          )}
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
                              {w.status === 'pending' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleAction('approve', w)} className="text-mint">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    批准
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAction('reject', w)} className="text-destructive">
                                    <XCircle className="w-4 h-4 mr-2" />
                                    拒绝
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {w.status === 'approved' && (
                                <DropdownMenuItem onClick={() => handleAction('process', w)}>
                                  <ArrowRight className="w-4 h-4 mr-2" />
                                  开始处理
                                </DropdownMenuItem>
                              )}
                              {w.status === 'reviewing' && (
                                <DropdownMenuItem onClick={() => handleAction('escalate', w)} className="text-amber-400">
                                  <AlertTriangle className="w-4 h-4 mr-2" />
                                  升级处理
                                </DropdownMenuItem>
                              )}
                              {w.txHash && (
                                <DropdownMenuItem onClick={() => window.open(`/tx/${w.txHash}`, '_blank')}>
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