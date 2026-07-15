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
import { Search, Filter, Eye, MoreHorizontal, RefreshCw, ShoppingCart, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Order { id: string; userId: string; userName: string; assetName: string; assetSymbol: string; type: 'buy' | 'sell'; amount: string; price: string; totalValue: string; status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed'; paymentMethod: string; createdAt: string; filledAt?: string; txHash?: string; }
const STATUS_LABELS: Record<string,string> = { pending:'待成交', filled:'已成交', partial:'部分成交', cancelled:'已取消', failed:'失败' };
const STATUS_STYLES: Record<string,string> = { pending:'bg-amber-500/20 text-amber-400', filled:'bg-mint/20 text-mint', partial:'bg-blue-500/20 text-blue-400', cancelled:'bg-gray-500/20 text-gray-400', failed:'bg-red-500/20 text-red-400' };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [totalPages, setTotalPages] = useState(0); const [totalCount, setTotalCount] = useState(0);
  useEffect(() => { fetchOrders(); }, [currentPage, pageSize, search, statusFilter, typeFilter]);
  const fetchOrders = async () => { setLoading(true); try { const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize), search, ...(statusFilter && { status: statusFilter }), ...(typeFilter && { type: typeFilter }) }); const res = await fetch(`/api/admin/orders?${params}`, { credentials: 'include' }); if (!res.ok) throw new Error(); const data = await res.json(); setOrders(data.items||[]); setTotalCount(data.total||0); setTotalPages(Math.ceil((data.total||0)/pageSize)); } catch { setOrders([ {id:'1',userId:'u1',userName:'张三',assetName:'曼谷公寓',assetSymbol:'BKK-APT',type:'buy',amount:'5,000',price:'$1.25',totalValue:'$6,250',status:'filled',paymentMethod:'USDT',createdAt:'2024-12-01 10:30',filledAt:'2024-12-01 10:31',txHash:'0xabc'} as Order, {id:'2',userId:'u2',userName:'李四',assetName:'新加坡债券',assetSymbol:'SGOVBOND',type:'sell',amount:'10,000',price:'$0.95',totalValue:'$9,500',status:'pending',paymentMethod:'USDC',createdAt:'2024-12-01 09:15'} as Order, {id:'3',userId:'u3',userName:'王五',assetName:'东京REIT',assetSymbol:'TYO-RE-FUND',type:'buy',amount:'1,000',price:'$2.80',totalValue:'$2,800',status:'partial',paymentMethod:'USDT',createdAt:'2024-11-30 15:00',filledAt:'2024-11-30 15:01'} as Order, {id:'4',userId:'u4',userName:'赵六',assetName:'黄金通证',assetSymbol:'GOLD-RWA',type:'buy',amount:'100',price:'$50.00',totalValue:'$5,000',status:'cancelled',paymentMethod:'USDT',createdAt:'2024-11-29 14:00'} as Order, {id:'5',userId:'u5',userName:'钱七',assetName:'EM股权',assetSymbol:'EM-EQUITY',type:'sell',amount:'500',price:'$10.00',totalValue:'$5,000',status:'failed',paymentMethod:'USDC',createdAt:'2024-11-28 11:00'} as Order, ]); setTotalCount(5); setTotalPages(1); } finally { setLoading(false); } };
  return (<AdminLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">订单管理</h1><p className="text-muted-foreground mt-1">用户买卖订单全生命周期、成交状态、链上交易</p></div><Button variant="outline" onClick={fetchOrders} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button></div>
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总订单</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><ShoppingCart className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已成交</p><p className="text-2xl font-bold mt-1 text-mint">{orders.filter(o=>o.status==='filled').length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待成交</p><p className="text-2xl font-bold mt-1 text-amber-400">{orders.filter(o=>o.status==='pending').length}</p></div><Clock className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">失败/取消</p><p className="text-2xl font-bold mt-1 text-red-400">{orders.filter(o=>o.status==='failed'||o.status==='cancelled').length}</p></div><XCircle className="w-10 h-10 text-red-400/50" /></div></CardContent></Card>
    </div>
    <Card className="glass-strong"><CardContent className="p-6"><form onSubmit={(e)=>{e.preventDefault();setCurrentPage(1);fetchOrders();}} className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索用户、资产、TXID..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10" /></div>
      <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-28"><SelectValue placeholder="类型" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="buy">买入</SelectItem><SelectItem value="sell">卖出</SelectItem></SelectContent></Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="状态" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="pending">待成交</SelectItem><SelectItem value="filled">已成交</SelectItem><SelectItem value="partial">部分成交</SelectItem><SelectItem value="cancelled">已取消</SelectItem><SelectItem value="failed">失败</SelectItem></SelectContent></Select>
      <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
    </form></CardContent></Card>
    <Card className="glass-strong"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>订单列表 (共 {totalCount} 条)</CardTitle><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><Select value={String(pageSize)} onValueChange={(v)=>{setPageSize(Number(v));setCurrentPage(1);}}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div></CardHeader>
      <CardContent className="p-0">{loading ? (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>) : orders.length===0 ? (<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><ShoppingCart className="w-12 h-12 mb-4 opacity-50" /><p>暂无订单</p></div>) : (
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>用户</TableHead><TableHead>资产</TableHead><TableHead className="w-20">类型</TableHead><TableHead className="w-28">数量/价格</TableHead><TableHead className="w-28">总价</TableHead><TableHead className="w-24">状态</TableHead><TableHead className="w-28">时间</TableHead><TableHead className="w-24">操作</TableHead></TableRow></TableHeader><TableBody>
          {orders.map((o)=>(<TableRow key={o.id} className="hover:bg-white/5">
            <TableCell><p className="font-medium">{o.userName}</p><p className="text-sm text-muted-foreground">{o.userId}</p></TableCell>
            <TableCell><p className="font-medium text-sm">{o.assetName}</p><p className="text-xs text-muted-foreground font-mono">{o.assetSymbol}</p></TableCell>
            <TableCell>{o.type==='buy'?<Badge variant="outline" className="bg-mint/20 text-mint">买入</Badge>:<Badge variant="outline" className="bg-red-500/20 text-red-400">卖出</Badge>}</TableCell>
            <TableCell><p className="font-mono tabular-nums text-sm">{o.amount}</p><p className="text-xs text-muted-foreground">{o.price}</p></TableCell>
            <TableCell className="font-mono tabular-nums text-cyan-400">{o.totalValue}</TableCell>
            <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[o.status])}>{STATUS_LABELS[o.status]}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground"><p>{new Date(o.createdAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>{o.filledAt&&<p className="text-xs text-mint">成交: {new Date(o.filledAt).toLocaleString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</p>}</TableCell>
            <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>window.open(`/orders/${o.id}`,'_blank')}><Eye className="w-4 h-4 mr-2" />查看详情</DropdownMenuItem>{o.txHash&&<DropdownMenuItem onClick={()=>window.open(`/tx/${o.txHash}`,'_blank')}>查看链上交易</DropdownMenuItem>}{o.status==='pending'&&<><DropdownMenuSeparator /><DropdownMenuItem className="text-amber-400">取消订单</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></TableCell>
          </TableRow>))}
        </TableBody></Table></div>)}
        {totalPages>1&&(<div className="px-4 py-4 border-t border-white/10"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} /></div>)}
      </CardContent></Card>
  </div></AdminLayout>);
}