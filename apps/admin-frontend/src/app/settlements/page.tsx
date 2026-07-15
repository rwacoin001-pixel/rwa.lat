'use client';
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, Eye, RefreshCw, Scale, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Settlement {
  id: string; orderId: string; userId: string; userName: string;
  assetSymbol: string; amount: string;
  settlementType: 'trade' | 'yield' | 'redemption' | 'fee';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chain: string; txHash?: string; gasFee?: string;
  settledAt?: string; createdAt: string;
}

const TYPE_LABELS: Record<string, string> = { trade: '交易结算', yield: '收益结算', redemption: '赎回结算', fee: '手续费结算' };
const STATUS_LABELS: Record<string, string> = { pending: '待结算', processing: '结算中', completed: '已结算', failed: '失败' };
const STATUS_STYLES: Record<string, string> = { pending: 'bg-amber-500/20 text-amber-400', processing: 'bg-blue-500/20 text-blue-400', completed: 'bg-mint/20 text-mint', failed: 'bg-red-500/20 text-red-400' };

export default function SettlementsPage() {
  const [items, setItems] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { fetchData(); }, [currentPage, pageSize, search, statusFilter, typeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize), search, ...(statusFilter && { status: statusFilter }), ...(typeFilter && { type: typeFilter }) });
      const res = await fetch(`/api/admin/settlements?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []); setTotalCount(data.total || 0); setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch {
      setItems([
        { id: '1', orderId: 'ord1', userId: 'u1', userName: '张三', assetSymbol: 'BKK-APT', amount: '$6,250', settlementType: 'trade', status: 'completed', chain: 'ethereum', txHash: '0xabc', gasFee: '$2.50', settledAt: '2024-12-01 10:32', createdAt: '2024-12-01 10:30' },
        { id: '2', orderId: 'ord2', userId: 'u2', userName: '李四', assetSymbol: 'SGOVBOND', amount: '$9,500', settlementType: 'trade', status: 'processing', chain: 'polygon', createdAt: '2024-12-01 09:15' },
        { id: '3', orderId: 'ord3', userId: 'u3', userName: '王五', assetSymbol: 'TYO-RE-FUND', amount: '$280', settlementType: 'yield', status: 'completed', chain: 'bsc', txHash: '0xdef', gasFee: '$0.10', settledAt: '2024-11-30 00:00', createdAt: '2024-11-30 00:00' },
        { id: '4', orderId: 'ord4', userId: 'u4', userName: '赵六', assetSymbol: 'GOLD-RWA', amount: '$5,000', settlementType: 'redemption', status: 'pending', chain: 'ethereum', createdAt: '2024-11-29 14:00' },
        { id: '5', orderId: 'ord5', userId: 'u5', userName: '钱七', assetSymbol: 'EM-EQUITY', amount: '$50', settlementType: 'fee', status: 'failed', chain: 'arbitrum', createdAt: '2024-11-28 11:00' },
      ]);
      setTotalCount(5); setTotalPages(1);
    } finally { setLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">结算管理</h1><p className="text-muted-foreground mt-1">交易结算、收益分配、赎回处理、链上确认全流程</p></div>
          <Button variant="outline" onClick={fetchData} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总结算</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><Scale className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已结算</p><p className="text-2xl font-bold mt-1 text-mint">{items.filter(i => i.status === 'completed').length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待结算</p><p className="text-2xl font-bold mt-1 text-amber-400">{items.filter(i => i.status === 'pending' || i.status === 'processing').length}</p></div><Clock className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">结算总额(USD)</p><p className="text-2xl font-bold mt-1 text-cyan-400">{items.filter(i => i.status === 'completed').reduce((s, i) => s + parseFloat(i.amount.replace(/[$,]/g, '')), 0).toLocaleString()}</p></div><DollarSign className="w-10 h-10 text-cyan-400/50" /></div></CardContent></Card>
        </div>
        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchData(); }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索用户、订单ID、TXID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
              <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">全部类型</option><option value="trade">交易结算</option><option value="yield">收益结算</option><option value="redemption">赎回结算</option><option value="fee">手续费结算</option></select>
              <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">全部状态</option><option value="pending">待结算</option><option value="processing">结算中</option><option value="completed">已结算</option><option value="failed">失败</option></select>
              <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>结算列表 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><select className="px-2 py-1 rounded bg-white/5 border border-white/10" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>) : items.length === 0 ? (<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Scale className="w-12 h-12 mb-4 opacity-50" /><p>暂无结算记录</p></div>) : (
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>用户</TableHead><TableHead className="w-24">资产</TableHead><TableHead className="w-28">金额</TableHead><TableHead className="w-24">类型</TableHead><TableHead className="w-24">链</TableHead><TableHead className="w-24">状态</TableHead><TableHead className="w-28">时间</TableHead><TableHead className="w-24">操作</TableHead></TableRow></TableHeader><TableBody>
                {items.map((s) => (
                  <TableRow key={s.id} className="hover:bg-white/5">
                    <TableCell><p className="font-medium">{s.userName}</p><p className="text-sm text-muted-foreground">{s.orderId}</p></TableCell>
                    <TableCell className="font-mono text-sm">{s.assetSymbol}</TableCell>
                    <TableCell className="font-mono tabular-nums text-cyan-400">{s.amount}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400">{TYPE_LABELS[s.settlementType]}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{s.chain}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[s.status])}>{STATUS_LABELS[s.status]}</Badge>{s.gasFee && <p className="text-xs text-muted-foreground mt-1">Gas: {s.gasFee}</p>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground"><p>{new Date(s.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>{s.settledAt && <p className="text-xs text-mint">{new Date(s.settledAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>}</TableCell>
                    <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => window.open(`/settlements/${s.id}`, '_blank')}>查看详情</DropdownMenuItem>{s.txHash && <DropdownMenuItem onClick={() => window.open(`/tx/${s.txHash}`, '_blank')}>查看链上交易</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell>
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