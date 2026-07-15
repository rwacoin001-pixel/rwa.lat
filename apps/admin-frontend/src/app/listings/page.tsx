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
import { Search, Filter, Eye, MoreHorizontal, RefreshCw, CheckCircle, XCircle, Clock, ListChecks, TrendingUp, Lock } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Listing {
  id: string;
  assetName: string;
  assetSymbol: string;
  providerName: string;
  listingType: 'primary' | 'secondary' | 'fundraising';
  minInvestment: string;
  maxInvestment: string;
  expectedReturn: string;
  lockupPeriod: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'live' | 'closed';
  submissionDate: string;
  reviewDate?: string;
  reviewerId?: string;
  rejectionReason?: string;
}

const TYPE_LABELS: Record<string, string> = {
  primary: '一级市场',
  secondary: '二级市场',
  fundraising: '募资',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  reviewing: '审核中',
  approved: '已批准',
  rejected: '已拒绝',
  live: '已上架',
  closed: '已下架',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  reviewing: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-mint/20 text-mint',
  rejected: 'bg-red-500/20 text-red-400',
  live: 'bg-green-500/20 text-green-400',
  closed: 'bg-gray-500/20 text-gray-400',
};

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { fetchListings(); }, [currentPage, pageSize, search, statusFilter, typeFilter]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize), search, ...(statusFilter && { status: statusFilter }), ...(typeFilter && { type: typeFilter }) });
      const res = await fetch(`/api/admin/listings?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setListings(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch {
      setListings([
        { id: '1', assetName: '曼谷核心区公寓 Token', assetSymbol: 'BKK-APT', providerName: 'Thai Property Co.', listingType: 'primary', minInvestment: '$100', maxInvestment: '$50,000', expectedReturn: '8.5% APY', lockupPeriod: '12个月', status: 'live', submissionDate: '2024-01-15', reviewDate: '2024-01-20', reviewerId: 'admin1' },
        { id: '2', assetName: '新加坡政府债券 Token', assetSymbol: 'SGOVBOND', providerName: 'SG Finance Ministry', listingType: 'primary', minInvestment: '$1,000', maxInvestment: '$500,000', expectedReturn: '4.2% APY', lockupPeriod: '6个月', status: 'live', submissionDate: '2024-02-20', reviewDate: '2024-02-25', reviewerId: 'admin2' },
        { id: '3', assetName: '东京商业地产基金', assetSymbol: 'TYO-RE-FUND', providerName: 'Japan REIT Corp', listingType: 'fundraising', minInvestment: '$500', maxInvestment: '$100,000', expectedReturn: '7.0% APY', lockupPeriod: '24个月', status: 'reviewing', submissionDate: '2024-03-10' },
        { id: '4', assetName: '黄金锚定通证', assetSymbol: 'GOLD-RWA', providerName: 'Global Gold Trust', listingType: 'secondary', minInvestment: '$50', maxInvestment: '$200,000', expectedReturn: '5.5% APY', lockupPeriod: '无', status: 'rejected', submissionDate: '2024-04-01', reviewDate: '2024-04-05', reviewerId: 'admin1', rejectionReason: '合规文件缺失' },
        { id: '5', assetName: '新兴市场股权 Token', assetSymbol: 'EM-EQUITY', providerName: 'EM Capital Group', listingType: 'primary', minInvestment: '$1,000', maxInvestment: '$1,000,000', expectedReturn: '12.0% APY', lockupPeriod: '36个月', status: 'pending', submissionDate: '2024-11-28' },
      ]);
      setTotalCount(5); setTotalPages(1);
    } finally { setLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">上架管理</h1><p className="text-muted-foreground mt-1">资产上架审批、募资规模、锁定期、预期收益管理</p></div>
          <Button variant="outline" onClick={fetchListings} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总计</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><ListChecks className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待审核</p><p className="text-2xl font-bold mt-1 text-amber-400">{listings.filter(l => l.status === 'pending' || l.status === 'reviewing').length}</p></div><Clock className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已上架</p><p className="text-2xl font-bold mt-1 text-mint">{listings.filter(l => l.status === 'live').length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已拒绝</p><p className="text-2xl font-bold mt-1 text-red-400">{listings.filter(l => l.status === 'rejected').length}</p></div><XCircle className="w-10 h-10 text-red-400/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已下架</p><p className="text-2xl font-bold mt-1 text-gray-400">{listings.filter(l => l.status === 'closed').length}</p></div><Lock className="w-10 h-10 text-gray-400/50" /></div></CardContent></Card>
        </div>

        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchListings(); }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索资产名称、符号、供应方..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
              <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="上架类型" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="primary">一级市场</SelectItem><SelectItem value="secondary">二级市场</SelectItem><SelectItem value="fundraising">募资</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="状态" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="pending">待审核</SelectItem><SelectItem value="reviewing">审核中</SelectItem><SelectItem value="approved">已批准</SelectItem><SelectItem value="rejected">已拒绝</SelectItem><SelectItem value="live">已上架</SelectItem><SelectItem value="closed">已下架</SelectItem></SelectContent></Select>
              <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>上架列表 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>) : listings.length === 0 ? (<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><ListChecks className="w-12 h-12 mb-4 opacity-50" /><p>暂无上架记录</p></div>) : (
              <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                <TableHead>资产名称/符号</TableHead><TableHead>供应方</TableHead><TableHead className="w-24">类型</TableHead><TableHead className="w-32">投资范围</TableHead><TableHead className="w-28">预期收益</TableHead><TableHead className="w-24">锁定期</TableHead><TableHead className="w-24">状态</TableHead><TableHead className="w-28">提交日期</TableHead><TableHead className="w-24">操作</TableHead>
              </TableRow></TableHeader><TableBody>
                {listings.map((l) => (
                  <TableRow key={l.id} className="hover:bg-white/5">
                    <TableCell><p className="font-medium">{l.assetName}</p><p className="text-sm text-muted-foreground font-mono">{l.assetSymbol}</p></TableCell>
                    <TableCell className="text-sm">{l.providerName}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400">{TYPE_LABELS[l.listingType]}</Badge></TableCell>
                    <TableCell><p className="font-mono text-xs">最低: {l.minInvestment}</p><p className="font-mono text-xs text-muted-foreground">最高: {l.maxInvestment}</p></TableCell>
                    <TableCell className="font-mono text-sm text-mint">{l.expectedReturn}</TableCell>
                    <TableCell className="text-sm">{l.lockupPeriod}</TableCell>
                    <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[l.status])}>{STATUS_LABELS[l.status]}</Badge>{l.rejectionReason && <p className="text-xs text-red-400 mt-1 truncate max-w-[100px]">{l.rejectionReason}</p>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground"><p>{new Date(l.submissionDate).toLocaleDateString('zh-CN')}</p>{l.reviewDate && <p className="text-xs text-blue-400">审核: {new Date(l.reviewDate).toLocaleDateString('zh-CN')}</p>}</TableCell>
                    <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.open(`/listings/${l.id}`, '_blank')}><Eye className="w-4 h-4 mr-2" />查看详情</DropdownMenuItem>
                      {l.status === 'pending' && <DropdownMenuItem className="text-mint"><CheckCircle className="w-4 h-4 mr-2" />批准上架</DropdownMenuItem>}
                      {l.status === 'pending' && <DropdownMenuItem className="text-destructive"><XCircle className="w-4 h-4 mr-2" />拒绝上架</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      {l.status === 'live' && <DropdownMenuItem className="text-amber-400">下架</DropdownMenuItem>}
                      {l.status === 'approved' && <DropdownMenuItem className="text-mint"><TrendingUp className="w-4 h-4 mr-2" />上架发行</DropdownMenuItem>}
                    </DropdownMenuContent></DropdownMenu></TableCell>
                  </TableRow>
                ))}
              </TableBody></Table></div>
            )}
            {totalPages > 1 && (<div className="px-4 py-4 border-t border-white/10"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} /></div>)}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}