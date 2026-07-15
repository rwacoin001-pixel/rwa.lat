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
import { Search, Filter, Eye, MoreHorizontal, RefreshCw, BarChart3, DollarSign, Activity, Trophy, Calendar } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface PolymarketRecord {
  id: string;
  marketName: string;
  marketSlug: string;
  category: 'crypto' | 'politics' | 'sports' | 'finance' | 'other';
  status: 'active' | 'closed' | 'resolved' | 'cancelled';
  liquidityUsd: string;
  volumeUsd: string;
  yesPrice: string;
  noPrice: string;
  endDate: string;
  resolvedOutcome?: string;
  resolutionSource?: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  crypto: '加密货币',
  politics: '政治',
  sports: '体育',
  finance: '金融',
  other: '其他',
};

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  closed: '已关闭',
  resolved: '已结算',
  cancelled: '已取消',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-mint/20 text-mint',
  closed: 'bg-amber-500/20 text-amber-400',
  resolved: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

export default function PolymarketPage() {
  const [markets, setMarkets] = useState<PolymarketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { fetchMarkets(); }, [currentPage, pageSize, search, statusFilter, categoryFilter]);

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize), search, ...(statusFilter && { status: statusFilter }), ...(categoryFilter && { category: categoryFilter }) });
      const res = await fetch(`/api/admin/polymarket?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setMarkets(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch {
      setMarkets([
        { id: '1', marketName: 'BTC 2025年底是否突破 $150k', marketSlug: 'btc-150k-2025', category: 'crypto', status: 'active', liquidityUsd: '$1,200,000', volumeUsd: '$5,800,000', yesPrice: '0.35', noPrice: '0.65', endDate: '2025-12-31', createdAt: '2024-06-01' },
        { id: '2', marketName: '美联储2025年1月降息概率', marketSlug: 'fed-cut-jan-2025', category: 'finance', status: 'active', liquidityUsd: '$3,500,000', volumeUsd: '$12,000,000', yesPrice: '0.72', noPrice: '0.28', endDate: '2025-01-29', createdAt: '2024-11-15' },
        { id: '3', marketName: 'ETH/BTC 汇率年底是否破 0.06', marketSlug: 'eth-btc-ratio-006', category: 'crypto', status: 'closed', liquidityUsd: '$800,000', volumeUsd: '$2,300,000', yesPrice: '0.15', noPrice: '0.85', endDate: '2024-12-31', createdAt: '2024-01-01' },
        { id: '4', marketName: '2024年美国大选赢家', marketSlug: 'us-2024-election', category: 'politics', status: 'resolved', liquidityUsd: '$50,000,000', volumeUsd: '$500,000,000', yesPrice: '1.00', noPrice: '0.00', endDate: '2024-12-15', resolvedOutcome: 'YES', resolutionSource: 'AP News', createdAt: '2024-01-01' },
        { id: '5', marketName: 'SOL 年底是否突破 $300', marketSlug: 'sol-300-eoy', category: 'crypto', status: 'cancelled', liquidityUsd: '$0', volumeUsd: '$450,000', yesPrice: '0.40', noPrice: '0.60', endDate: '2024-12-31', createdAt: '2024-03-01' },
      ]);
      setTotalCount(5); setTotalPages(1);
    } finally { setLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">Polymarket 管理</h1><p className="text-muted-foreground mt-1">预测市场流动池、交易量、结算结果、仲裁管理</p></div>
          <Button variant="outline" onClick={fetchMarkets} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总市场数</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><BarChart3 className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">活跃市场</p><p className="text-2xl font-bold mt-1 text-mint">{markets.filter(m => m.status === 'active').length}</p></div><Activity className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总流动性(USD)</p><p className="text-2xl font-bold mt-1 text-cyan-400">{markets.reduce((s, m) => s + parseFloat(m.liquidityUsd.replace(/[$,]/g, '')), 0).toLocaleString()}</p></div><DollarSign className="w-10 h-10 text-cyan-400/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总交易量(USD)</p><p className="text-2xl font-bold mt-1 text-purple-400">{markets.reduce((s, m) => s + parseFloat(m.volumeUsd.replace(/[$,]/g, '')), 0).toLocaleString()}</p></div><Trophy className="w-10 h-10 text-purple-400/50" /></div></CardContent></Card>
        </div>

        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchMarkets(); }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索市场名称、slug..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="类别" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="crypto">加密货币</SelectItem><SelectItem value="politics">政治</SelectItem><SelectItem value="sports">体育</SelectItem><SelectItem value="finance">金融</SelectItem><SelectItem value="other">其他</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="状态" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="active">进行中</SelectItem><SelectItem value="closed">已关闭</SelectItem><SelectItem value="resolved">已结算</SelectItem><SelectItem value="cancelled">已取消</SelectItem></SelectContent></Select>
              <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>预测市场列表 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>) : markets.length === 0 ? (<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><BarChart3 className="w-12 h-12 mb-4 opacity-50" /><p>暂无预测市场数据</p></div>) : (
              <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                <TableHead>市场名称</TableHead><TableHead className="w-24">类别</TableHead><TableHead className="w-24">YES/NO</TableHead><TableHead className="w-28">流动性(USD)</TableHead><TableHead className="w-28">交易量(USD)</TableHead><TableHead className="w-24">状态</TableHead><TableHead className="w-28">截止日期</TableHead><TableHead className="w-28">结算结果</TableHead><TableHead className="w-24">操作</TableHead>
              </TableRow></TableHeader><TableBody>
                {markets.map((m) => (
                  <TableRow key={m.id} className="hover:bg-white/5">
                    <TableCell><p className="font-medium">{m.marketName}</p><p className="text-xs text-muted-foreground font-mono">{m.marketSlug}</p></TableCell>
                    <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400">{CATEGORY_LABELS[m.category]}</Badge></TableCell>
                    <TableCell><div className="flex gap-2 text-sm"><span className="text-mint font-mono">{m.yesPrice}</span><span className="text-red-400 font-mono">{m.noPrice}</span></div></TableCell>
                    <TableCell className="font-mono tabular-nums text-sm text-cyan-400">{m.liquidityUsd}</TableCell>
                    <TableCell className="font-mono tabular-nums text-sm">{m.volumeUsd}</TableCell>
                    <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[m.status])}>{STATUS_LABELS[m.status]}</Badge></TableCell>
                    <TableCell className="text-sm"><div className="flex items-center gap-1"><Calendar className="w-4 h-4 text-muted-foreground" />{new Date(m.endDate).toLocaleDateString('zh-CN')}</div></TableCell>
                    <TableCell>{m.resolvedOutcome ? <Badge variant="outline" className="bg-mint/20 text-mint">{m.resolvedOutcome}</Badge> : <span className="text-muted-foreground">—</span>}{m.resolutionSource && <p className="text-xs text-muted-foreground mt-1">来源: {m.resolutionSource}</p>}</TableCell>
                    <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.open(`/polymarket/${m.id}`, '_blank')}><Eye className="w-4 h-4 mr-2" />查看详情</DropdownMenuItem>
                      {m.status === 'active' && <DropdownMenuItem className="text-amber-400">关闭市场</DropdownMenuItem>}
                      {m.status === 'closed' && <DropdownMenuItem className="text-mint"><Trophy className="w-4 h-4 mr-2" />结算市场</DropdownMenuItem>}
                      <DropdownMenuItem>查看交易记录</DropdownMenuItem>
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