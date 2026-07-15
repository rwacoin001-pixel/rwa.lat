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
import { Search, Filter, Eye, Edit, AlertTriangle, MoreHorizontal, Scale, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface EligibilityRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'kyc' | 'geography' | 'balance' | 'activity' | 'custom';
  conditions: string[];
  action: 'allow' | 'deny' | 'review';
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  kyc: 'KYC 规则',
  geography: '地域规则',
  balance: '余额规则',
  activity: '活跃度规则',
  custom: '自定义规则',
};

const ACTION_LABELS: Record<string, string> = {
  allow: '允许',
  deny: '拒绝',
  review: '人工审核',
};

const ACTION_STYLES: Record<string, string> = {
  allow: 'bg-mint/20 text-mint',
  deny: 'bg-red-500/20 text-red-400',
  review: 'bg-amber-500/20 text-amber-400',
};

export default function EligibilityPage() {
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [currentPage, pageSize, search, typeFilter, actionFilter, statusFilter]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(typeFilter && { ruleType: typeFilter }),
        ...(actionFilter && { action: actionFilter }),
        ...(statusFilter && { isActive: String(statusFilter === 'active') }),
      });

      const res = await fetch(`/api/admin/eligibility/rules?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取资格规则失败');
      
      const data = await res.json();
      setRules(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch eligibility rules:', err);
      // Fallback mock data
      setRules([
        { id: '1', name: '基础KYC通过规则', description: '用户完成基础KYC认证即可参与', ruleType: 'kyc', conditions: ['kycStatus == approved', 'kycLevel in [basic, enhanced, institutional]'], action: 'allow', priority: 10, isActive: true, createdAt: '2024-01-15', updatedAt: '2024-01-15', createdBy: 'admin1' },
        { id: '2', name: '高风险国家拒绝规则', description: 'FATF高风险国家用户直接拒绝', ruleType: 'geography', conditions: ['country in [KP, IR, MM]', 'riskLevel == critical'], action: 'deny', priority: 1, isActive: true, createdAt: '2024-01-10', updatedAt: '2024-01-10', createdBy: 'admin1' },
        { id: '3', name: '大额资金人工审核', description: '单笔超过10万USDT需人工审核', ruleType: 'balance', conditions: ['amount > 100000', 'currency == USDT'], action: 'review', priority: 5, isActive: true, createdAt: '2024-02-01', updatedAt: '2024-02-01', createdBy: 'admin2' },
        { id: '4', name: '长期不活跃账户限制', description: '180天未登录限制提现', ruleType: 'activity', conditions: ['lastLoginAt < now - 180d'], action: 'deny', priority: 8, isActive: false, createdAt: '2024-03-15', updatedAt: '2024-03-15', createdBy: 'admin1' },
        { id: '5', name: '机构用户快速通道', description: '机构认证用户免除部分验证', ruleType: 'custom', conditions: ['kycLevel == institutional', 'whitelisted == true'], action: 'allow', priority: 2, isActive: true, createdAt: '2024-04-01', updatedAt: '2024-04-01', createdBy: 'admin2' },
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
    fetchRules();
  };

  const handleToggle = (rule: EligibilityRule) => {
    // TODO: API call
    setRules(rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
  };

  const handleAction = (action: string, rule: EligibilityRule) => {
    switch (action) {
      case 'view':
        window.open(`/eligibility/${rule.id}`, '_blank');
        break;
      case 'edit':
        setShowCreateModal(true);
        break;
      case 'toggle':
        handleToggle(rule);
        break;
      case 'delete':
        if (confirm(`确定要删除规则 "${rule.name}" 吗？`)) {
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
            <h1 className="text-3xl font-bold tracking-tight">资格规则管理</h1>
            <p className="text-muted-foreground mt-1">配置用户参与资格、风控规则与审核策略</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentPage(1)} className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              刷新
            </Button>
            <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              新建规则
            </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索规则名称、描述..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="规则类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="kyc">KYC 规则</SelectItem>
                  <SelectItem value="geography">地域规则</SelectItem>
                  <SelectItem value="balance">余额规则</SelectItem>
                  <SelectItem value="activity">活跃度规则</SelectItem>
                  <SelectItem value="custom">自定义规则</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="执行动作" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="allow">允许</SelectItem>
                  <SelectItem value="deny">拒绝</SelectItem>
                  <SelectItem value="review">人工审核</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">禁用</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Rules Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>规则列表 (共 {totalCount} 条)</CardTitle>
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
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Scale className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无资格规则</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">优先级</TableHead>
                      <TableHead>规则名称</TableHead>
                      <TableHead className="w-32">类型</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead className="w-28">动作</TableHead>
                      <TableHead className="w-20">状态</TableHead>
                      <TableHead className="w-32">创建时间</TableHead>
                      <TableHead className="w-28">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id} className="hover:bg-white/5">
                        <TableCell className="font-mono font-bold text-mint">
                          #{rule.priority}
                        </TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{RULE_TYPE_LABELS[rule.ruleType]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {rule.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(ACTION_STYLES[rule.action])}>
                            {ACTION_LABELS[rule.action]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? 'mint' : 'secondary'}>
                            {rule.isActive ? '启用' : '禁用'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(rule.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAction('view', rule)}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('edit', rule)}>
                                <Edit className="w-4 h-4 mr-2" />
                                编辑规则
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('toggle', rule)}>
                                {rule.isActive ? '禁用' : '启用'}规则
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleAction('delete', rule)}>
                                删除规则
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