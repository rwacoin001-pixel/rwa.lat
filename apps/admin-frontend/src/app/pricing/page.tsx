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
import { Search, Filter, Eye, Edit, MoreHorizontal, RefreshCw, DollarSign, TrendingUp, TrendingDown, BarChart3, DollarSign as Coins } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Pricing {
  id: string;
  assetName: string;
  assetSymbol: string;
  currentPrice: string;
  previousPrice: string;
  change24h: string;
  changePercent24h: string;
  volume24h: string;
  marketCap: string;
  lastUpdated: string;
  updatedBy: string;
  source: 'oracle' | 'manual' | 'chainlink' | 'api';
}

const SOURCE_LABELS: Record<string, string> = {
  oracle: 'Oracle',
  manual: '手动',
  chainlink: 'Chainlink',
  api: 'API',
};

const SOURCE_STYLES: Record<string, string> = {
  oracle: 'bg-purple-500/20 text-purple-400',
  manual: 'bg-amber-500/20 text-amber-400',
  chainlink: 'bg-blue-500/20 text-blue-400',
  api: 'bg-green-500/20 text-green-400',
};

export default function PricingPage() {
  const [pricings, setPricings] = useState<Pricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { fetchPricings(); }, [currentPage, pageSize, search, sourceFilter]);

  const fetchPricings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize), search, ...(sourceFilter && { source: sourceFilter }) });
      const res = await fetch(`/api/admin/pricing?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setPricings(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch {
      setPricings([
        { id: '1', assetName: '曼谷核心区公寓 Token', assetSymbol: 'BKK-APT', currentPrice: '$1.25', previousPrice: '$1.20', change24h: '+$0.05', changePercent24h: '+4.17%', volume24h: '$125,000', marketCap: '$1,250,000', lastUpdated: '2024-12-01 12:00', updatedBy: 'oracle', source: 'oracle' },
        { id: '2', assetName: '新加坡政府债券 Token', assetSymbol: 'SGOVBOND', currentPrice: '$0.95', previousPrice: '$0.96', change24h: '-$0.01', changePercent24h: '-1.04%', volume24h: '$500,000', marketCap: '$9,500,000', lastUpdated: '2024-12-01 11:55', updatedBy: 'chainlink', source: 'chainlink' },
        { id: '3', assetName: '东京商业地产基金', assetSymbol: 'TYO-RE-FUND', currentPrice: '$2.80', previousPrice: '$2.75', change24h: '+$0.05', changePercent24h: '+1.82%', volume24h: '$280,000', marketCap: '$14,000,000', lastUpdated: '2024-12-01 12:00', updatedBy: 'api', source: 'api' },
        { id: '4', assetName: '黄金锚定通证', assetSymbol: 'GOLD-RWA', currentPrice: '$50.00', previousPrice: '$48.50', change24h: '+$1.50', changePercent24h: '+3.09%', volume24h: '$2,500,000', marketCap: '$100,000,000', lastUpdated: '2024-12-01 11:58', updatedBy: 'chainlink', source: 'chainlink' },
        { id: '5', assetName: '新兴市场股权 Token', assetSymbol: 'EM-EQUITY', currentPrice: '$10.00', previousPrice: '$10.00', change24h: '$0.00', changePercent24h: '0.00%', volume24h: '$0', marketCap: '$5,000,000', lastUpdated: '2024-11-28 10:00', updatedBy: 'admin1', source: 'manual' },
      ]);
      setTotalCount(5); setTotalPages(1);
    } finally { setLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">价格管理</h1><p className="text-muted-foreground mt-1">资产价格、Oracle 来源、24h 涨跌、交易量实时监控</p></div>
          <Button variant="outline" onClick={fetchPricings} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">追踪资产数</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><Coins className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">24h 上涨</p><p className="text-2xl font-bold mt-1 text-mint">{pricings.filter(p => parseFloat(p.change24h.replace(/[+$]/g, '')) > 0).length}</p></div><TrendingUp className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">24h 下跌</p><p className="text-2xl font-bold mt-1 text-red-400">{pricings.filter(p => parseFloat(p.change24h.replace(/[-$]/g, '')) < 0).length}</p></div><TrendingDown className="w-10 h-10 text-red-400/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">24h 交易量(USD)</p><p className="text-2xl font-bold mt-1 text-cyan-400">{pricings.reduce((s, p) => s + parseFloat(p.volume24h.replace(/[$,]/g, '')), 0).toLocaleString()}</p></div><BarChart3 className="w-10 h-10 text-cyan-400/50" /></div></CardContent></Card>
        </div>

        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchPricings(); }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索资产名称、符号..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="价格来源" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="oracle">Oracle</SelectItem><SelectItem value="manual">手动</SelectItem><SelectItem value="chainlink">Chainlink</SelectItem><SelectItem value="api">API</SelectItem></SelectContent></Select>
              <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>价格列表 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>) : pricings.length === 0 ? (<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><DollarSign className="w-12 h-12 mb-4 opacity-50" /><p>暂无价格数据</p></div>) : (
              <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                <TableHead>资产名称/符号</TableHead><TableHead className="w-28">当前价格</TableHead><TableHead className="w-28">前价</TableHead><TableHead className="w-28">24h 变动</TableHead><TableHead className="w-28">24h 交易量</TableHead><TableHead className="w-32">市值</TableHead><TableHead className="w-24">来源</TableHead><TableHead className="w-28">更新时间</TableHead><TableHead className="w-24">操作</TableHead>
              </TableRow></TableHeader><TableBody>
                {pricings.map((p) => {
                  const isUp = parseFloat(p.change24h.replace(/[+$]/g, '')) > 0;
                  const isDown = parseFloat(p.change24h.replace(/[-$]/g, '')) < 0;
                  return (
                    <TableRow key={p.id} className="hover:bg-white/5">
                      <TableCell><p className="font-medium">{p.assetName}</p><p className="text-sm text-muted-foreground font-mono">{p.assetSymbol}</p></TableCell>
                      <TableCell className="font-mono tabular-nums font-medium">{p.currentPrice}</TableCell>
                      <TableCell className="font-mono tabular-nums text-sm text-muted-foreground">{p.previousPrice}</TableCell>
                      <TableCell>
                        <div className={cn('flex items-center gap-1', isUp ? 'text-mint' : isDown ? 'text-red-400' : 'text-gray-400')}>
                          {isUp ? <TrendingUp className="w-4 h-4" /> : isDown ? <TrendingDown className="w-4 h-4" /> : null}
                          <span className="font-mono text-sm">{p.change24h}</span>
                          <span className="font-mono text-xs">({p.changePercent24h})</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-sm">{p.volume24h}</TableCell>
                      <TableCell className="font-mono tabular-nums text-sm text-cyan-400">{p.marketCap}</TableCell>
                      <TableCell><Badge variant="outline" className={cn(SOURCE_STYLES[p.source])}>{SOURCE_LABELS[p.source]}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(p.lastUpdated).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(`/pricing/${p.id}`, '_blank')}><Eye className="w-4 h-4 mr-2" />查看历史</DropdownMenuItem>
                        <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />手动调价</DropdownMenuItem>
                      </DropdownMenuContent></DropdownMenu></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody></Table></div>
            )}
            {totalPages > 1 && (<div className="px-4 py-4 border-t border-white/10"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} /></div>)}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}