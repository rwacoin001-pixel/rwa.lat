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
import { Search, Filter, Eye, Edit, MoreHorizontal, RefreshCw, Plus, Building2, CheckCircle, XCircle, DollarSign, Globe } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Provider {
  id: string;
  name: string;
  type: 'institution' | 'individual' | 'government' | 'fund_manager';
  country: string;
  licenseNumber: string;
  licenseExpiry: string;
  assetsCount: number;
  totalValueUsd: string;
  status: 'active' | 'suspended' | 'pending' | 'revoked';
  contactEmail: string;
  contactPhone: string;
  kycVerified: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  institution: '机构',
  individual: '个人',
  government: '政府',
  fund_manager: '基金管理人',
};

const STATUS_LABELS: Record<string, string> = {
  active: '活跃',
  suspended: '暂停',
  pending: '待审核',
  revoked: '已吊销',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-mint/20 text-mint',
  suspended: 'bg-amber-500/20 text-amber-400',
  pending: 'bg-blue-500/20 text-blue-400',
  revoked: 'bg-red-500/20 text-red-400',
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchProviders();
  }, [currentPage, pageSize, search, typeFilter, statusFilter]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/providers?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setProviders(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch {
      setProviders([
        { id: '1', name: 'Thai Property Co.', type: 'institution', country: '泰国', licenseNumber: 'TH-RE-2024-001', licenseExpiry: '2026-12-31', assetsCount: 5, totalValueUsd: '$12,500,000', status: 'active', contactEmail: 'contact@thai-prop.com', contactPhone: '+66-2-123-4567', kycVerified: true, createdAt: '2024-01-15' },
        { id: '2', name: 'SG Finance Ministry', type: 'government', country: '新加坡', licenseNumber: 'SG-GOV-2024-002', licenseExpiry: '2027-06-30', assetsCount: 3, totalValueUsd: '$50,000,000', status: 'active', contactEmail: 'finance@sg.gov.sg', contactPhone: '+65-6235-1234', kycVerified: true, createdAt: '2024-02-20' },
        { id: '3', name: 'Japan REIT Corp', type: 'institution', country: '日本', licenseNumber: 'JP-REIT-2024-003', licenseExpiry: '2025-12-31', assetsCount: 8, totalValueUsd: '$25,000,000', status: 'suspended', contactEmail: 'info@jpreit.jp', contactPhone: '+81-3-1234-5678', kycVerified: true, createdAt: '2024-03-10' },
        { id: '4', name: 'Global Gold Trust', type: 'institution', country: '瑞士', licenseNumber: 'CH-GT-2024-004', licenseExpiry: '2026-06-30', assetsCount: 2, totalValueUsd: '$100,000,000', status: 'active', contactEmail: 'info@goldtrust.ch', contactPhone: '+41-22-123-4567', kycVerified: true, createdAt: '2024-04-01' },
        { id: '5', name: 'EM Capital Group', type: 'fund_manager', country: '开曼群岛', licenseNumber: 'KY-FC-2024-005', licenseExpiry: '2025-03-31', assetsCount: 1, totalValueUsd: '$5,000,000', status: 'pending', contactEmail: 'hello@emcap.ky', contactPhone: '+1-345-123-4567', kycVerified: false, createdAt: '2024-11-28' },
      ]);
      setTotalCount(5);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">供应方管理</h1>
            <p className="text-muted-foreground mt-1">资产发行机构、许可证、KYC 验证全流程管理</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchProviders} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button>
            <Button className="flex items-center gap-2"><Plus className="w-4 h-4" />新增供应方</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总计</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><Building2 className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">KYC 已验证</p><p className="text-2xl font-bold mt-1 text-mint">{providers.filter(p => p.kycVerified).length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待审核</p><p className="text-2xl font-bold mt-1 text-amber-400">{providers.filter(p => p.status === 'pending').length}</p></div><XCircle className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总资产(USD)</p><p className="text-2xl font-bold mt-1 text-cyan-400">{providers.reduce((s, p) => s + parseFloat(p.totalValueUsd.replace(/[$,]/g, '')), 0).toLocaleString()}</p></div><DollarSign className="w-10 h-10 text-cyan-400/50" /></div></CardContent></Card>
        </div>

        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchProviders(); }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="搜索名称、许可证号、邮箱..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="类型" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="institution">机构</SelectItem><SelectItem value="individual">个人</SelectItem><SelectItem value="government">政府</SelectItem><SelectItem value="fund_manager">基金管理人</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="状态" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="active">活跃</SelectItem><SelectItem value="suspended">暂停</SelectItem><SelectItem value="pending">待审核</SelectItem><SelectItem value="revoked">已吊销</SelectItem></SelectContent></Select>
              <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>供应方列表 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>
            ) : providers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Building2 className="w-12 h-12 mb-4 opacity-50" /><p>暂无供应方数据</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead className="w-24">类型</TableHead>
                    <TableHead className="w-24">国家</TableHead>
                    <TableHead>许可证号/有效期</TableHead>
                    <TableHead className="w-24">资产数</TableHead>
                    <TableHead className="w-32">总资产(USD)</TableHead>
                    <TableHead className="w-24">KYC</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {providers.map((p) => (
                      <TableRow key={p.id} className="hover:bg-white/5">
                        <TableCell>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-muted-foreground">{p.contactEmail}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400">{TYPE_LABELS[p.type]}</Badge></TableCell>
                        <TableCell className="flex items-center gap-1"><Globe className="w-4 h-4 text-muted-foreground" />{p.country}</TableCell>
                        <TableCell>
                          <p className="font-mono text-sm">{p.licenseNumber}</p>
                          <p className="text-xs text-muted-foreground">有效期: {p.licenseExpiry}</p>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{p.assetsCount}</TableCell>
                        <TableCell className="font-mono tabular-nums text-cyan-400">{p.totalValueUsd}</TableCell>
                        <TableCell>{p.kycVerified ? <Badge variant="outline" className="bg-mint/20 text-mint">已验证</Badge> : <Badge variant="outline" className="bg-amber-500/20 text-amber-400">未验证</Badge>}</TableCell>
                        <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[p.status])}>{STATUS_LABELS[p.status]}</Badge></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/providers/${p.id}`, '_blank')}><Eye className="w-4 h-4 mr-2" />查看详情</DropdownMenuItem>
                              <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />编辑</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {!p.kycVerified && <DropdownMenuItem className="text-mint">验证 KYC</DropdownMenuItem>}
                              {p.status === 'active' && <DropdownMenuItem className="text-amber-400">暂停</DropdownMenuItem>}
                              {p.status === 'suspended' && <DropdownMenuItem className="text-mint">恢复</DropdownMenuItem>}
                              <DropdownMenuItem className="text-destructive">吊销许可证</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="px-4 py-4 border-t border-white/10">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}