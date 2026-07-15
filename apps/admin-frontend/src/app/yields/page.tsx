'use client';
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, Eye, RefreshCw, TrendingUp, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Yield { id: string; assetName: string; assetSymbol: string; userId: string; userName: string; yieldType: 'staking'|'dividend'|'interest'|'capital_gain'; amount: string; status: 'pending'|'distributed'|'failed'; distributionDate: string; chain: string; txHash?: string; }
const TYPE_LABELS: Record<string,string> = { staking:'质押收益', dividend:'分红', interest:'利息', capital_gain:'资本利得' };
const STATUS_LABELS: Record<string,string> = { pending:'待发放', distributed:'已发放', failed:'失败' };
const STATUS_STYLES: Record<string,string> = { pending:'bg-amber-500/20 text-amber-400', distributed:'bg-mint/20 text-mint', failed:'bg-red-500/20 text-red-400' };

export default function YieldsPage() {
  const [items, setItems] = useState<Yield[]>([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [totalPages, setTotalPages] = useState(0); const [totalCount, setTotalCount] = useState(0);
  useEffect(() => { fetchData(); }, [currentPage, pageSize, search, statusFilter, typeFilter]);
  const fetchData = async () => { setLoading(true); try { const params = new URLSearchParams({ page:String(currentPage), limit:String(pageSize), search, ...(statusFilter&&{status:statusFilter}), ...(typeFilter&&{type:typeFilter}) }); const res = await fetch(`/api/admin/yields?${params}`, { credentials: 'include' }); if (!res.ok) throw new Error(); const data = await res.json(); setItems(data.items||[]); setTotalCount(data.total||0); setTotalPages(Math.ceil((data.total||0)/pageSize)); } catch { setItems([ {id:'1',assetName:'曼谷公寓',assetSymbol:'BKK-APT',userId:'u1',userName:'张三',yieldType:'dividend',amount:'$125',status:'distributed',distributionDate:'2024-12-01',chain:'ethereum',txHash:'0xabc'}, {id:'2',assetName:'新加坡债券',assetSymbol:'SGOVBOND',userId:'u2',userName:'李四',yieldType:'interest',amount:'$380',status:'distributed',distributionDate:'2024-12-01',chain:'polygon',txHash:'0xdef'}, {id:'3',assetName:'东京REIT',assetSymbol:'TYO-RE-FUND',userId:'u3',userName:'王五',yieldType:'dividend',amount:'$196',status:'pending',distributionDate:'2024-12-15',chain:'bsc'}, {id:'4',assetName:'黄金通证',assetSymbol:'GOLD-RWA',userId:'u4',userName:'赵六',yieldType:'capital_gain',amount:'$1,500',status:'distributed',distributionDate:'2024-11-30',chain:'ethereum',txHash:'0xghi'}, {id:'5',assetName:'EM股权',assetSymbol:'EM-EQUITY',userId:'u5',userName:'钱七',yieldType:'staking',amount:'$50',status:'failed',distributionDate:'2024-11-28',chain:'arbitrum'}, ]); setTotalCount(5); setTotalPages(1); } finally { setLoading(false); } };
  return (<AdminLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">收益管理</h1><p className="text-muted-foreground mt-1">质押收益、分红、利息、资本利得发放全流程</p></div><Button variant="outline" onClick={fetchData} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button></div>
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总收益记录</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><TrendingUp className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已发放</p><p className="text-2xl font-bold mt-1 text-mint">{items.filter(i=>i.status==='distributed').length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待发放</p><p className="text-2xl font-bold mt-1 text-amber-400">{items.filter(i=>i.status==='pending').length}</p></div><Clock className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">发放总额(USD)</p><p className="text-2xl font-bold mt-1 text-cyan-400">{items.filter(i=>i.status==='distributed').reduce((s,i)=>s+parseFloat(i.amount.replace(/[$,]/g,'')),0).toLocaleString()}</p></div><DollarSign className="w-10 h-10 text-cyan-400/50" /></div></CardContent></Card>
    </div>
    <Card className="glass-strong"><CardContent className="p-6"><form onSubmit={(e)=>{e.preventDefault();setCurrentPage(1);fetchData();}} className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索用户、资产..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10" /></div>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}><option value="">全部类型</option><option value="staking">质押收益</option><option value="dividend">分红</option><option value="interest">利息</option><option value="capital_gain">资本利得</option></select>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="">全部状态</option><option value="pending">待发放</option><option value="distributed">已发放</option><option value="failed">失败</option></select>
      <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
    </form></CardContent></Card>
    <Card className="glass-strong"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>收益列表 (共 {totalCount} 条)</CardTitle><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><select className="px-2 py-1 rounded bg-white/5 border border-white/10" value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></div></CardHeader>
      <CardContent className="p-0">{loading?(<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>):items.length===0?(<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><TrendingUp className="w-12 h-12 mb-4 opacity-50" /><p>暂无收益记录</p></div>):(
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>用户</TableHead><TableHead>资产</TableHead><TableHead className="w-24">类型</TableHead><TableHead className="w-28">金额</TableHead><TableHead className="w-24">链</TableHead><TableHead className="w-24">状态</TableHead><TableHead className="w-28">发放日期</TableHead><TableHead className="w-24">操作</TableHead></TableRow></TableHeader><TableBody>
          {items.map((y)=>(<TableRow key={y.id} className="hover:bg-white/5">
            <TableCell><p className="font-medium">{y.userName}</p><p className="text-sm text-muted-foreground">{y.userId}</p></TableCell>
            <TableCell><p className="font-medium text-sm">{y.assetName}</p><p className="text-xs text-muted-foreground font-mono">{y.assetSymbol}</p></TableCell>
            <TableCell><Badge variant="outline" className="bg-purple-500/20 text-purple-400">{TYPE_LABELS[y.yieldType]}</Badge></TableCell>
            <TableCell className="font-mono tabular-nums text-cyan-400">{y.amount}</TableCell>
            <TableCell><Badge variant="outline">{y.chain}</Badge></TableCell>
            <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[y.status])}>{STATUS_LABELS[y.status]}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{new Date(y.distributionDate).toLocaleDateString('zh-CN')}</TableCell>
            <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>window.open(`/yields/${y.id}`,'_blank')}>查看详情</DropdownMenuItem>{y.txHash&&<DropdownMenuItem onClick={()=>window.open(`/tx/${y.txHash}`,'_blank')}>查看链上交易</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell>
          </TableRow>))}
        </TableBody></Table></div>)}
        {totalPages>1&&(<div className="px-4 py-4 border-t border-white/10"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} /></div>)}
      </CardContent></Card>
  </div></AdminLayout>);
}