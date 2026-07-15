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
import { Search, Filter, Eye, Edit, AlertTriangle, MoreHorizontal, Shield } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface KYCCase {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected' | 'supplement';
  level: 'basic' | 'enhanced' | 'institutional';
  submittedAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  documents: string[];
  riskFlags: string[];
}

const KYC_STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  supplement: '需补件',
};

const KYC_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-mint/20 text-mint',
  rejected: 'bg-red-500/20 text-red-400',
  supplement: 'bg-cyan-500/20 text-cyan-400',
};

const LEVEL_LABELS: Record<string, string> = {
  basic: '基础认证',
  enhanced: '增强认证',
  institutional: '机构认证',
};

const LEVEL_STYLES: Record<string, string> = {
  basic: 'bg-blue-500/20 text-blue-400',
  enhanced: 'bg-purple-500/20 text-purple-400',
  institutional: 'bg-cyan-500/20 text-cyan-400',
};

export default function KYCPage() {
  const [cases, setCases] = useState<KYCCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchCases();
  }, [currentPage, pageSize, search, statusFilter, levelFilter]);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(statusFilter && { status: statusFilter }),
        ...(levelFilter && { level: levelFilter }),
      });

      const res = await fetch(`/api/admin/kyc?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取KYC列表失败');
      
      const data = await res.json();
      setCases(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch KYC cases:', err);
      // Fallback mock data
      setCases([
        { id: '1', userId: 'u1', userName: '张三', userEmail: 'zhang@example.com', status: 'pending', level: 'basic', submittedAt: '2024-11-28', documents: ['身份证', '自拍'], riskFlags: [] },
        { id: '2', userId: 'u2', userName: '李四', userEmail: 'li@example.com', status: 'supplement', level: 'enhanced', submittedAt: '2024-11-27', documents: ['护照', '地址证明'], riskFlags: ['地址不匹配'] },
        { id: '3', userId: 'u3', userName: '王五', userEmail: 'wang@example.com', status: 'approved', level: 'institutional', submittedAt: '2024-11-25', reviewedAt: '2024-11-26', reviewerId: 'admin1', documents: ['营业执照', '法人身份证', '授权书'], riskFlags: [] },
        { id: '4', userId: 'u4', userName: '赵六', userEmail: 'zhao@example.com', status: 'rejected', level: 'basic', submittedAt: '2024-11-20', reviewedAt: '2024-11-21', reviewerId: 'admin2', documents: ['身份证'], riskFlags: ['身份证过期'] },
        { id: '5', userId: 'u5', userName: '钱七', userEmail: 'qian@example.com', status: 'pending', level: 'enhanced', submittedAt: '2024-11-29', documents: ['护照', '银行流水'], riskFlags: ['高风险地区'] },
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
    fetchCases();
  };

  const handleAction = (action: string, kycCase: KYCCase) => {
    switch (action) {
      case 'view':
        window.open(`/kyc/${kycCase.id}`, '_blank');
        break;
      case 'approve':
        if (confirm(`确定通过 ${kycCase.userName} 的 KYC 审核？`)) {
          // TODO: API call
        }
        break;
      case 'reject':
        if (confirm(`确定拒绝 ${kycCase.userName} 的 KYC 申请？`)) {
          // TODO: API call
        }
        break;
      case 'supplement':
        window.open(`/kyc/${kycCase.id}/supplement`, '_blank');
        break;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">KYC 审核</h1>
            <p className="text-muted-foreground mt-1">审核用户身份认证申请</p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => setCurrentPage(1)}>
            <Filter className="w-4 h-4" />
            刷新
          </Button>
        </div>

        {/* Filters & Search */}
        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户名、邮箱、ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="KYC 状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="pending">待审核</SelectItem>
                  <SelectItem value="approved">已通过</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                  <SelectItem value="supplement">需补件</SelectItem>
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="认证级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="basic">基础认证</SelectItem>
                  <SelectItem value="enhanced">增强认证</SelectItem>
                  <SelectItem value="institutional">机构认证</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* KYC Cases Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>KYC 案件列表 (共 {totalCount} 条)</CardTitle>
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
            ) : cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Shield className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无 KYC 案件</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead>用户信息</TableHead>
                      <TableHead className="w-36">KYC 状态</TableHead>
                      <TableHead className="w-32">认证级别</TableHead>
                      <TableHead className="w-32">提交时间</TableHead>
                      <TableHead className="w-32">审核时间</TableHead>
                      <TableHead className="w-40">风险标记</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map((k) => (
                      <TableRow key={k.id} className="hover:bg-white/5">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {k.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{k.userName}</p>
                            <p className="text-sm text-muted-foreground">{k.userEmail}</p>
                            <p className="text-xs text-muted-foreground font-mono">{k.userId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(KYC_STATUS_STYLES[k.status])}>
                            {KYC_STATUS_LABELS[k.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(LEVEL_STYLES[k.level])}>
                            {LEVEL_LABELS[k.level]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(k.submittedAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {k.reviewedAt ? new Date(k.reviewedAt).toLocaleDateString('zh-CN') : '—'}
                        </TableCell>
                        <TableCell>
                          {k.riskFlags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {k.riskFlags.map((flag) => (
                                <Badge key={flag} variant="destructive" className="text-xs">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">无</span>
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
                              <DropdownMenuItem onClick={() => handleAction('view', k)}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              {k.status === 'pending' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleAction('approve', k)}>
                                    <Shield className="w-4 h-4 mr-2" />
                                    通过审核
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAction('reject', k)} className="text-destructive">
                                    拒绝审核
                                  </DropdownMenuItem>
                                </>
                              )}
                              {k.status === 'supplement' && (
                                <DropdownMenuItem onClick={() => handleAction('supplement', k)}>
                                  查看补件
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