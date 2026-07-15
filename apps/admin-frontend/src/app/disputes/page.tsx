'use client';
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, Eye, RefreshCw, AlertTriangle, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Dispute { id: string; orderId: string; userId: string; userName: string; type: 'order_failed'|'settlement_error'|'unauthorized'|'product_quality'|'other'; status: 'open'|'investigating'|'resolved'|'escalated'; priority: 'low'|'normal'|'high'|'urgent'; description: string; resolution?: string; assignedTo?: string; createdAt: string; }
const TYPE_LABELS: Record<string,string> = { order_failed:'订单失败', settlement_error:'结算错误', unauthorized:'未授权操作', product_quality:'产品质量', other:'其他' };
const STATUS_LABELS: Record<string,string> = { open:'待处理', investigating:'调查中', resolved:'已解决', escalated:'已升级' };
const STATUS_STYLES: Record<string,string> = { open:'bg-amber-500/20 text-amber-400', investigating:'bg-blue-500/20 text-blue-400', resolved:'bg-mint/20 text-mint', escalated:'bg-red-500/20 text-red-400' };
const PRIORITY_STYLES: Record<string,string> = { low:'bg-green-500/20 text-green-400', normal:'bg-blue-500/20 text-blue-400', high:'bg-amber-500/20 text-amber-400', urgent:'bg-red-500/20 text-red-400' };
const PRIORITY_LABELS: Record<string,string> = { low:'低', normal:'普通', high:'高', urgent:'紧急' };

export default function DisputesPage() {
  const [items, setItems] = useState<Dispute[]>([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [totalPages, setTotalPages] = useState(0); const [totalCount, setTotalCount] = useState(0);
  useEffect(() => { fetchData(); }, [currentPage, pageSize, search, statusFilter, typeFilter]);
  const fetchData = async () => { setLoading(true); try { const params = new URLSearchParams({ page:String(currentPage), limit:String(pageSize), search, ...(statusFilter&&{status:statusFilter}), ...(typeFilter&&{type:typeFilter}) }); const res = await fetch(`/api/admin/disputes?${params}`, { credentials: 'include' }); if (!res.ok) throw new Error(); const data = await res.json(); setItems(data.items||[]); setTotalCount(data.total||0); setTotalPages(Math.ceil((data.total||0)/pageSize)); } catch { setItems([ {id:'1',orderId:'ord5',userId:'u5',userName:'钱七',type:'order_failed',status:'open',priority:'urgent',description:'卖出500股EM-EQUITY失败，资金未退回',assignedTo:'admin1',createdAt:'2024-11-28 11:30'}, {id:'2',orderId:'ord4',userId:'u4',userName:'赵六',type:'settlement_error',status:'investigating',priority:'high',description:'黄金赎回结算金额不符',assignedTo:'admin2',createdAt:'2024-11-29 14:30'}, {id:'3',orderId:'ord3',userId:'u3',userName:'王五',type:'product_quality',status:'resolved',priority:'normal',description:'东京REIT分红金额低于预期',resolution:'经核实为除权日调整导致，已向用户解释',assignedTo:'admin1',createdAt:'2024-11-30 15:30'}, {id:'4',orderId:'ord2',userId:'u2',userName:'李四',type:'unauthorized',status:'escalated',priority:'urgent',description:'账户出现未授权的卖出操作',assignedTo:'admin1',createdAt:'2024-12-01 09:45'}, {id:'5',orderId:'ord1',userId:'u1',userName:'张三',type:'other',status:'resolved',priority:'low',description:'请求修改订单备注',resolution:'已修改',assignedTo:'admin2',createdAt:'2024-12-01 10:45'}, ]); setTotalCount(5); setTotalPages(1); } finally { setLoading(false); } };
  return (<AdminLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">争议管理</h1><p className="text-muted-foreground mt-1">订单争议、结算异常、未授权操作、产品质量投诉处理</p></div><Button variant="outline" onClick={fetchData} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button></div>
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总争议</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><MessageSquare className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待处理</p><p className="text-2xl font-bold mt-1 text-amber-400">{items.filter(i=>i.status==='open').length}</p></div><Clock className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已解决</p><p className="text-2xl font-bold mt-1 text-mint">{items.filter(i=>i.status==='resolved').length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">紧急</p><p className="text-2xl font-bold mt-1 text-red-400">{items.filter(i=>i.priority==='urgent').length}</p></div><AlertTriangle className="w-10 h-10 text-red-400/50" /></div></CardContent></Card>
    </div>
    <Card className="glass-strong"><CardContent className="p-6"><form onSubmit={(e)=>{e.preventDefault();setCurrentPage(1);fetchData();}} className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索用户、订单ID..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10" /></div>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}><option value="">全部类型</option><option value="order_failed">订单失败</option><option value="settlement_error">结算错误</option><option value="unauthorized">未授权操作</option><option value="product_quality">产品质量</option><option value="other">其他</option></select>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="">全部状态</option><option value="open">待处理</option><option value="investigating">调查中</option><option value="resolved">已解决</option><option value="escalated">已升级</option></select>
      <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
    </form></CardContent></Card>
    <Card className="glass-strong"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>争议列表 (共 {totalCount} 条)</CardTitle><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><select className="px-2 py-1 rounded bg-white/5 border border-white/10" value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></div></CardHeader>
      <CardContent className="p-0">{loading?(<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>):items.length===0?(<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><AlertTriangle className="w-12 h-12 mb-4 opacity-50" /><p>暂无争议记录</p></div>):(
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>用户</TableHead><TableHead className="w-24">类型</TableHead><TableHead className="w-24">优先级</TableHead><TableHead>描述</TableHead><TableHead className="w-24">状态</TableHead><TableHead>处理人</TableHead><TableHead className="w-28">时间</TableHead><TableHead className="w-24">操作</TableHead></TableRow></TableHeader><TableBody>
          {items.map((d)=>(<TableRow key={d.id} className="hover:bg-white/5">
            <TableCell><p className="font-medium">{d.userName}</p><p className="text-sm text-muted-foreground">{d.orderId}</p></TableCell>
            <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400">{TYPE_LABELS[d.type]}</Badge></TableCell>
            <TableCell><Badge variant="outline" className={cn(PRIORITY_STYLES[d.priority])}>{PRIORITY_LABELS[d.priority]}</Badge></TableCell>
            <TableCell className="text-sm max-w-[200px] truncate">{d.description}{d.resolution&&<p className="text-xs text-mint mt-1 truncate">处理: {d.resolution}</p>}</TableCell>
            <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[d.status])}>{STATUS_LABELS[d.status]}</Badge></TableCell>
            <TableCell className="text-sm">{d.assignedTo||<span className="text-muted-foreground">未分配</span>}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{new Date(d.createdAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</TableCell>
            <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>window.open(`/disputes/${d.id}`,'_blank')}>查看详情</DropdownMenuItem>{d.status==='open'&&<DropdownMenuItem className="text-mint">开始调查</DropdownMenuItem>}{d.status==='investigating'&&<DropdownMenuItem className="text-mint">标记已解决</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell>
          </TableRow>))}
        </TableBody></Table></div>)}
        {totalPages>1&&(<div className="px-4 py-4 border-t border-white/10"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} /></div>)}
      </CardContent></Card>
  </div></AdminLayout>);
}