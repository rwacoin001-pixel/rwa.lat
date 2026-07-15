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
import { Search, Filter, User, Shield, AlertTriangle, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  name: string;
  kycStatus: 'pending' | 'approved' | 'rejected' | 'supplement';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  lastLoginAt: string;
  walletCount: number;
  totalBalance: string;
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

const RISK_LEVEL_STYLES: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

const RISK_LEVEL_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '极高',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, search, kycFilter, riskFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(kycFilter && { kycStatus: kycFilter }),
        ...(riskFilter && { riskLevel: riskFilter }),
      });

      const res = await fetch(`/api/admin/users?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取用户列表失败');
      
      const data = await res.json();
      setUsers(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch users:', err);
      // Fallback mock data for demo
      setUsers([
        { id: '1', email: 'user1@example.com', name: '张三', kycStatus: 'approved', riskLevel: 'low', createdAt: '2024-01-15', lastLoginAt: '2024-12-01', walletCount: 3, totalBalance: '50,000 USDT' },
        { id: '2', email: 'user2@example.com', name: '李四', kycStatus: 'pending', riskLevel: 'medium', createdAt: '2024-02-20', lastLoginAt: '2024-12-02', walletCount: 1, totalBalance: '10,000 USDT' },
        { id: '3', email: 'user3@example.com', name: '王五', kycStatus: 'supplement', riskLevel: 'high', createdAt: '2024-03-10', lastLoginAt: '2024-11-28', walletCount: 2, totalBalance: '100,000 USDT' },
        { id: '4', email: 'user4@example.com', name: '赵六', kycStatus: 'rejected', riskLevel: 'critical', createdAt: '2024-01-05', lastLoginAt: '2024-11-15', walletCount: 0, totalBalance: '0 USDT' },
        { id: '5', email: 'user5@example.com', name: '钱七', kycStatus: 'approved', riskLevel: 'low', createdAt: '2024-04-12', lastLoginAt: '2024-12-03', walletCount: 4, totalBalance: '250,000 USDT' },
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
    fetchUsers();
  };

  const handleAction = (action: string, user: User) => {
    switch (action) {
      case 'view':
        window.open(`/users/${user.id}`, '_blank');
        break;
      case 'kyc':
        window.open(`/kyc/${user.id}`, '_blank');
        break;
      case 'risk':
        window.open(`/risk/${user.id}`, '_blank');
        break;
      case 'wallets':
        window.open(`/users/${user.id}/wallets`, '_blank');
        break;
      case 'suspend':
        if (confirm(`确定要暂停用户 ${user.name} 的账户吗？`)) {
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
            <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
            <p className="text-muted-foreground mt-1">查看、搜索和管理平台用户</p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => setCurrentPage(1)}>
            <Search className="w-4 h-4" />
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
                  placeholder="搜索邮箱、姓名、ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={kycFilter} onValueChange={setKycFilter}>
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
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-full sm:w-40">
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
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>用户列表 (共 {totalCount} 条)</CardTitle>
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
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <User className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无用户数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead>用户信息</TableHead>
                      <TableHead className="w-36">KYC 状态</TableHead>
                      <TableHead className="w-28">风险等级</TableHead>
                      <TableHead className="w-32">钱包/余额</TableHead>
                      <TableHead className="w-40">最后登录</TableHead>
                      <TableHead className="w-40">注册时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="hover:bg-white/5">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {user.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(KYC_STATUS_STYLES[user.kycStatus])}>
                            {KYC_STATUS_LABELS[user.kycStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(RISK_LEVEL_STYLES[user.riskLevel])}>
                            {RISK_LEVEL_LABELS[user.riskLevel]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{user.walletCount} 个钱包</p>
                            <p className="text-muted-foreground">{user.totalBalance}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.lastLoginAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAction('view', user)}>
                                <User className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('kyc', user)}>
                                <Shield className="w-4 h-4 mr-2" />
                                KYC 审核
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('risk', user)}>
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                风险画像
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('wallets', user)}>
                                钱包管理
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleAction('suspend', user)}
                              >
                                暂停账户
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