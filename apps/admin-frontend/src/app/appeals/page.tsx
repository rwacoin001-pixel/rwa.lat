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
import { Search, Filter, Eye, Edit, AlertTriangle, MoreHorizontal, MessageSquare, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Appeal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'kyc_rejected' | 'account_suspended' | 'transaction_blocked' | 'risk_flagged' | 'other';
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'escalated';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reason: string;
  description: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  resolution?: string;
  attachments: string[];
}

const TYPE_LABELS: Record<string, string> = {
  kyc_rejected: 'KYC 被拒申诉',
  account_suspended: '账户暂停申诉',
  transaction_blocked: '交易拦截申诉',
  risk_flagged: '风控标记申诉',
  other: '其他',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  under_review: '审核中',
  approved: '已通过',
  rejected: '已驳回',
  escalated: '已升级',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  under_review: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-mint/20 text-mint',
  rejected: 'bg-red-500/20 text-red-400',
  escalated: 'bg-purple-500/20 text-purple-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  normal: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchAppeals();
  }, [currentPage, pageSize, search, typeFilter, statusFilter, priorityFilter]);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
      });

      const res = await fetch(`/api/admin/appeals?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取申诉列表失败');
      
      const data = await res.json();
      setAppeals(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch appeals:', err);
      // Fallback mock data
      setAppeals([
        { id: '1', userId: 'u1', userName: '张三', userEmail: 'zhang@example.com', type: 'kyc_rejected', status: 'pending', priority: 'high', reason: '身份证照片不清晰', description: '重新上传了清晰的身份证照片，请重新审核', submittedAt: '2024-11-28', attachments: ['id_card_front.jpg', 'id_card_back.jpg'] },
        { id: '2', userId: 'u2', userName: '李四', userEmail: 'li@example.com', type: 'account_suspended', status: 'under_review', priority: 'urgent', reason: '误判为洗钱', description: '正常商业往来资金，提供合同和发票证明', submittedAt: '2024-11-27', reviewedAt: '2024-11-28', reviewerId: 'admin1', attachments: ['contract.pdf', 'invoice.pdf'] },
        { id: '3', userId: 'u3', userName: '王五', userEmail: 'wang@example.com', type: 'transaction_blocked', status: 'approved', priority: 'normal', reason: '大额转账被拦截', description: '向自有钱包转账，非外部转账', submittedAt: '2024-11-25', reviewedAt: '2024-11-26', reviewerId: 'admin2', resolution: '已放行，属正常自有资金转移', attachments: [] },
        { id: '4', userId: 'u4', userName: '赵六', userEmail: 'zhao@example.com', type: 'risk_flagged', status: 'rejected', priority: 'high', reason: '高风险标记申诉', description: '从未进行过可疑操作，请核实', submittedAt: '2024-11-20', reviewedAt: '2024-11-22', reviewerId: 'admin1', resolution: '经核实风控模型判定准确，维持原判', attachments: [] },
        { id: '5', userId: 'u5', userName: '钱七', userEmail: 'qian@example.com', type: 'other', status: 'escalated', priority: 'urgent', reason: '账户被冻结申诉', description: '需要紧急使用资金支付医疗费用', submittedAt: '2024-11-29', reviewedAt: '2024-11-29', reviewerId: 'admin3', attachments: ['medical_bill.pdf'] },
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
    fetchAppeals();
  };

  const handleAction = (action: string, appeal: Appeal) => {
    switch (action) {
      case 'view':
        window.open(`/appeals/${appeal.id}`, '_blank');
        break;
      case 'review':
        window.open(`/appeals/${appeal.id}/review`, '_blank');
        break;
      case 'escalate':
        if (confirm(`确定将申诉 ${appeal.id} 升级处理吗？`)) {
          // TODO: API call
        }
        break;
      case 'approve':
        if (confirm(`确定批准申诉 ${appeal.id} 吗？`)) {
          // TODO: API call
        }
        break;
      case 'reject':
        if (confirm(`确定驳回申诉 ${appeal.id} 吗？`)) {
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
            <h1 className="text-3xl font-bold tracking-tight">申诉管理</h1>
            <p className="text-muted-foreground mt-1">处理用户 KYC、账户、交易、风控等申诉案件</p>
          </div>
          <Button variant="outline" onClick={() => setCurrentPage(1)} className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            刷新
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待处理</p>
                  <p className="text-2xl font-bold mt-1">{appeals.filter(a => a.status === 'pending').length}</p>
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
                  <p className="text-2xl font-bold mt-1">{appeals.filter(a => a.status === 'under_review').length}</p>
                </div>
                <MessageSquare className="w-10 h-10 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">紧急申诉</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{appeals.filter(a => a.priority === 'urgent').length}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已通过</p>
                  <p className="text-2xl font-bold mt-1 text-mint">{appeals.filter(a => a.status === 'approved').length}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已驳回</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{appeals.filter(a => a.status === 'rejected').length}</p>
                </div>
                <XCircle className="w-10 h-10 text-red-400/50" />
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
                  placeholder="搜索用户、邮箱、申诉ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="申诉类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="kyc_rejected">KYC 被拒</SelectItem>
                  <SelectItem value="account_suspended">账户暂停</SelectItem>
                  <SelectItem value="transaction_blocked">交易拦截</SelectItem>
                  <SelectItem value="risk_flagged">风控标记</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="处理状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="under_review">审核中</SelectItem>
                  <SelectItem value="approved">已通过</SelectItem>
                  <SelectItem value="rejected">已驳回</SelectItem>
                  <SelectItem value="escalated">已升级</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="优先级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Appeals Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>申诉列表 (共 {totalCount} 条)</CardTitle>
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
            ) : appeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无申诉记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead className="w-32">申诉类型</TableHead>
                      <TableHead className="w-24">优先级</TableHead>
                      <TableHead>申诉原因</TableHead>
                      <TableHead className="w-28">状态</TableHead>
                      <TableHead className="w-32">提交时间</TableHead>
                      <TableHead className="w-28">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appeals.map((appeal) => (
                      <TableRow key={appeal.id} className="hover:bg-white/5">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {appeal.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{appeal.userName}</p>
                            <p className="text-sm text-muted-foreground">{appeal.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{TYPE_LABELS[appeal.type]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(PRIORITY_STYLES[appeal.priority])}>
                            {PRIORITY_LABELS[appeal.priority]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {appeal.reason}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[appeal.status])}>
                            {STATUS_LABELS[appeal.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(appeal.submittedAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAction('view', appeal)}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              {appeal.status === 'pending' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleAction('review', appeal)}>
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    开始审核
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAction('approve', appeal)} className="text-mint">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    批准申诉
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAction('reject', appeal)} className="text-destructive">
                                    <XCircle className="w-4 h-4 mr-2" />
                                    驳回申诉
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => handleAction('escalate', appeal)}>
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                升级处理
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