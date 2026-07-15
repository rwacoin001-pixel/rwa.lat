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
import { Search, Filter, Eye, Edit, MoreHorizontal, Globe, Shield, Lock, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface RegionStrategy {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  status: 'allowed' | 'restricted' | 'blocked' | 'pending_review';
  kycRequired: boolean;
  enhancedKycRequired: boolean;
  allowedProducts: string[];
  blockedProducts: string[];
  maxInvestmentUsd: number;
  amlRiskScore: number;
  sanctionsList: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

const STATUS_LABELS: Record<string, string> = {
  allowed: '准入',
  restricted: '限制准入',
  blocked: '禁止准入',
  pending_review: '待复核',
};

const STATUS_STYLES: Record<string, string> = {
  allowed: 'bg-mint/20 text-mint',
  restricted: 'bg-amber-500/20 text-amber-400',
  blocked: 'bg-red-500/20 text-red-400',
  pending_review: 'bg-blue-500/20 text-blue-400',
};

const KYC_LABELS: Record<string, string> = {
  true: '基础 KYC',
  false: '无需 KYC',
};

const ENHANCED_KYC_LABELS: Record<string, string> = {
  true: '需增强 KYC',
  false: '仅基础 KYC',
};

export default function RegionsPage() {
  const [regions, setRegions] = useState<RegionStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchRegions();
  }, [currentPage, pageSize, search, statusFilter]);

  const fetchRegions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/admin/regions?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取地域策略失败');
      
      const data = await res.json();
      setRegions(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch regions:', err);
      // Fallback mock data
      setRegions([
        { id: '1', code: 'US', name: '美国', nameEn: 'United States', status: 'allowed', kycRequired: true, enhancedKycRequired: false, allowedProducts: ['USDT', 'USDC', 'BTC', 'ETH'], blockedProducts: [], maxInvestmentUsd: 1000000, amlRiskScore: 15, sanctionsList: [], notes: '标准准入，需基础KYC', createdAt: '2024-01-15', updatedAt: '2024-11-01', updatedBy: 'admin1' },
        { id: '2', code: 'CN', name: '中国', nameEn: 'China', status: 'blocked', kycRequired: false, enhancedKycRequired: false, allowedProducts: [], blockedProducts: ['ALL'], maxInvestmentUsd: 0, amlRiskScore: 95, sanctionsList: [], notes: '监管禁止，全面封禁', createdAt: '2024-01-10', updatedAt: '2024-11-15', updatedBy: 'admin1' },
        { id: '3', code: 'SG', name: '新加坡', nameEn: 'Singapore', status: 'allowed', kycRequired: true, enhancedKycRequired: true, allowedProducts: ['USDT', 'USDC', 'BTC', 'ETH', 'TOKEN_A'], blockedProducts: [], maxInvestmentUsd: 5000000, amlRiskScore: 10, sanctionsList: [], notes: '金融中心，需增强KYC', createdAt: '2024-01-20', updatedAt: '2024-11-10', updatedBy: 'admin2' },
        { id: '4', code: 'RU', name: '俄罗斯', nameEn: 'Russia', status: 'restricted', kycRequired: true, enhancedKycRequired: true, allowedProducts: ['USDT'], blockedProducts: ['USDC', 'TOKEN_A', 'TOKEN_B'], maxInvestmentUsd: 10000, amlRiskScore: 75, sanctionsList: ['OFAC', 'EU'], notes: '制裁名单国家，仅限USDT小额', createdAt: '2024-02-01', updatedAt: '2024-11-05', updatedBy: 'admin1' },
        { id: '5', code: 'KP', name: '朝鲜', nameEn: 'North Korea', status: 'blocked', kycRequired: false, enhancedKycRequired: false, allowedProducts: [], blockedProducts: ['ALL'], maxInvestmentUsd: 0, amlRiskScore: 100, sanctionsList: ['OFAC', 'UN', 'EU'], notes: '全面制裁，完全封禁', createdAt: '2024-01-10', updatedAt: '2024-11-15', updatedBy: 'admin1' },
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
    fetchRegions();
  };

  const handleAction = (action: string, region: RegionStrategy) => {
    switch (action) {
      case 'view':
        window.open(`/regions/${region.id}`, '_blank');
        break;
      case 'edit':
        // TODO: Open edit modal
        break;
      case 'toggle':
        setRegions(regions.map(r => r.id === region.id ? { ...r, status: r.status === 'allowed' ? 'restricted' : 'allowed' } : r));
        break;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">地域准入策略</h1>
            <p className="text-muted-foreground mt-1">管理各国家/地区的准入状态、KYC 要求、产品限制与投资额度</p>
          </div>
          <Button variant="outline" onClick={() => setCurrentPage(1)} className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            刷新
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">全面准入</p>
                  <p className="text-2xl font-bold mt-1 text-mint">{regions.filter(r => r.status === 'allowed').length}</p>
                </div>
                <Globe className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">限制准入</p>
                  <p className="text-2xl font-bold mt-1 text-amber-400">{regions.filter(r => r.status === 'restricted').length}</p>
                </div>
                <Shield className="w-10 h-10 text-amber-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">禁止准入</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{regions.filter(r => r.status === 'blocked').length}</p>
                </div>
                <Lock className="w-10 h-10 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待复核</p>
                  <p className="text-2xl font-bold mt-1 text-blue-400">{regions.filter(r => r.status === 'pending_review').length}</p>
                </div>
                <MapPin className="w-10 h-10 text-blue-400/50" />
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
                  placeholder="搜索国家代码、名称、英文名..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="准入状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="allowed">准入</SelectItem>
                  <SelectItem value="restricted">限制准入</SelectItem>
                  <SelectItem value="blocked">禁止准入</SelectItem>
                  <SelectItem value="pending_review">待复核</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Regions Table */}
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>地域策略列表 (共 {totalCount} 条)</CardTitle>
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
            ) : regions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Globe className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无地域策略数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">代码</TableHead>
                      <TableHead>国家/地区</TableHead>
                      <TableHead className="w-32">准入状态</TableHead>
                      <TableHead className="w-28">KYC 要求</TableHead>
                      <TableHead className="w-28">增强 KYC</TableHead>
                      <TableHead className="w-32">最大投资额</TableHead>
                      <TableHead className="w-24">AML 风险分</TableHead>
                      <TableHead className="w-32">制裁名单</TableHead>
                      <TableHead className="w-40">更新时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regions.map((r) => (
                      <TableRow key={r.id} className="hover:bg-white/5">
                        <TableCell className="font-mono text-sm font-medium">{r.code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="text-sm text-muted-foreground">{r.nameEn}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[r.status])}>
                            {STATUS_LABELS[r.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(r.kycRequired ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400')}>
                            {r.kycRequired ? KYC_LABELS.true : KYC_LABELS.false}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(r.enhancedKycRequired ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400')}>
                            {r.enhancedKycRequired ? ENHANCED_KYC_LABELS.true : ENHANCED_KYC_LABELS.false}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          ${r.maxInvestmentUsd.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums" style={{ color: r.amlRiskScore > 70 ? '#ef4444' : r.amlRiskScore > 40 ? '#f59e0b' : '#22c55e' }}>
                          {r.amlRiskScore}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.sanctionsList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.sanctionsList.slice(0, 3).map((list) => (
                                <Badge key={list} variant="destructive" className="text-xs">
                                  {list}
                                </Badge>
                              ))}
                              {r.sanctionsList.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{r.sanctionsList.length - 3}</Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">无</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.updatedAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAction('view', r)}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('edit', r)}>
                                <Edit className="w-4 h-4 mr-2" />
                                编辑策略
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAction('toggle', r)}>
                                {r.status === 'allowed' ? '设为限制' : '设为准入'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('block', r)} className="text-destructive">
                                <Lock className="w-4 h-4 mr-2" />
                                完全封禁
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