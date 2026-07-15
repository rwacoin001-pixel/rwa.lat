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
import { Search, Filter, Eye, AlertTriangle, MoreHorizontal, TrendingUp, Shield, Target, Edit } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface RiskRule {
  id: string;
  name: string;
  description: string;
  category: 'transaction' | 'behavior' | 'geography' | 'identity' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggerCount: number;
  isActive: boolean;
  conditions: string[];
  actions: string[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  transaction: '交易风控',
  behavior: '行为风控',
  geography: '地域风控',
  identity: '身份风控',
  compliance: '合规风控',
};

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '极高',
};

export default function RiskPage() {
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [currentPage, pageSize, search, categoryFilter, severityFilter, statusFilter]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(categoryFilter && { category: categoryFilter }),
        ...(severityFilter && { severity: severityFilter }),
        ...(statusFilter && { isActive: String(statusFilter === 'active') }),
      });

      const res = await fetch(`/api/admin/risk/rules?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取风控规则失败');
      
      const data = await res.json();
      setRules(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch risk rules:', err);
      // Fallback mock data
      setRules([
        { id: '1', name: '大额单笔交易监控', description: '单笔交易超过 50,000 USDT 触发告警', category: 'transaction', severity: 'high', triggerCount: 127, isActive: true, conditions: ['amount > 50000', 'currency in [USDT, USDC]'], actions: ['alert', 'review'], createdAt: '2024-01-10', updatedAt: '2024-01-10' },
        { id: '2', name: '高频交易检测', description: '1小时内交易超过 20 笔', category: 'behavior', severity: 'medium', triggerCount: 89, isActive: true, conditions: ['tx_count_1h > 20'], actions: ['alert', 'limit'], createdAt: '2024-02-15', updatedAt: '2024-02-15' },
        { id: '3', name: '制裁名单匹配', description: 'OFAC/UN 制裁名单实时匹配', category: 'compliance', severity: 'critical', triggerCount: 3, isActive: true, conditions: ['sanctions_match == true'], actions: ['block', 'alert', 'report'], createdAt: '2024-01-05', updatedAt: '2024-01-05' },
        { id: '4', name: '新设备登录风控', description: '首次从新设备/地点登录需二次验证', category: 'identity', severity: 'medium', triggerCount: 456, isActive: true, conditions: ['device_fingerprint_new == true'], actions: ['mfa_required', 'email_notify'], createdAt: '2024-03-01', updatedAt: '2024-03-01' },
        { id: '5', name: '高风险国家交易限制', description: 'FATF 高风险国家资金流向监控', category: 'geography', severity: 'high', triggerCount: 12, isActive: true, conditions: ['country in [KP, IR, MM, SY]', 'direction == outbound'], actions: ['review', 'limit', 'alert'], createdAt: '2024-02-20', updatedAt: '2024-02-20' },
        { id: '6', name: '洗钱模式检测', description: '拆分交易/快进快出模式识别', category: 'transaction', severity: 'critical', triggerCount: 8, isActive: false, conditions: ['layering_pattern == true', 'velocity_high == true'], actions: ['investigate', 'freeze', 'report'], createdAt: '2024-04-10', updatedAt: '2024-04-10' },
      ]);
      setTotalCount(6);
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

  const handleToggle = (rule: RiskRule) => {
    setRules(rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
  };

  const handleAction = (action: string, rule: RiskRule) => {
    switch (action) {
      case 'view':
        window.open(`/risk/${rule.id}`, '_blank');
        break;
      case 'edit':
        setShowCreateModal(true);
        break;
      case 'toggle':
        handleToggle(rule);
        break;
      case 'test':
        window.open(`/risk/${rule.id}/test`, '_blank');
        break;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">风控规则管理</h1>
            <p className="text-muted-foreground mt-1">配置交易、行为、身份、地域、合规风控规则</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentPage(1)} className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              刷新
            </Button>
            <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              新建规则
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">活跃规则</p>
                  <p className="text-2xl font-bold mt-1">{rules.filter(r => r.isActive).length}</p>
                </div>
                <Shield className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总触发次数(24h)</p>
                  <p className="text-2xl font-bold mt-1">{rules.reduce((sum, r) => sum + r.triggerCount, 0).toLocaleString()}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-amber-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">极高风险规则</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{rules.filter(r => r.severity === 'critical').length}</p>
                </div>
                <Target className="w-10 h-10 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">规则分类</p>
                  <p className="text-2xl font-bold mt-1">{new Set(rules.map(r => r.category)).size}</p>
                </div>
                <Shield className="w-10 h-10 text-cyan-400/50" />
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
                  placeholder="搜索规则名称、描述..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="风控分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="transaction">交易风控</SelectItem>
                  <SelectItem value="behavior">行为风控</SelectItem>
                  <SelectItem value="geography">地域风控</SelectItem>
                  <SelectItem value="identity">身份风控</SelectItem>
                  <SelectItem value="compliance">合规风控</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="严重程度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="critical">极高</SelectItem>
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
            <CardTitle>风控规则列表 (共 {totalCount} 条)</CardTitle>
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
                <Target className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无风控规则</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">严重程度</TableHead>
                      <TableHead>规则名称</TableHead>
                      <TableHead className="w-32">分类</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead className="w-24">触发次数(24h)</TableHead>
                      <TableHead className="w-20">状态</TableHead>
                      <TableHead className="w-32">更新时间</TableHead>
                      <TableHead className="w-28">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id} className="hover:bg-white/5">
                        <TableCell>
                          <Badge variant="outline" className={cn(SEVERITY_STYLES[rule.severity])}>
                            {SEVERITY_LABELS[rule.severity]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{CATEGORY_LABELS[rule.category]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {rule.description}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-amber-400">
                          {rule.triggerCount}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? 'mint' : 'secondary'}>
                            {rule.isActive ? '启用' : '禁用'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(rule.updatedAt).toLocaleDateString('zh-CN')}
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
                              <DropdownMenuItem onClick={() => handleAction('test', rule)}>
                                <Shield className="w-4 h-4 mr-2" />
                                模拟测试
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