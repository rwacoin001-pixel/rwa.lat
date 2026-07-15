'use client';
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, Eye, RefreshCw, Headphones, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Ticket { id: string; userId: string; userName: string; subject: string; category: 'account'|'transaction'|'kyc'|'technical'|'other'; status: 'open'|'pending'|'resolved'|'closed'; priority: 'low'|'normal'|'high'|'urgent'; assignedTo?: string; createdAt: string; resolvedAt?: string; }
const CATEGORY_LABELS: Record<string,string> = { account:'账户', transaction:'交易', kyc:'KYC', technical:'技术', other:'其他' };
const STATUS_LABELS: Record<string,string> = { open:'待处理', pending:'处理中', resolved:'已解决', closed:'已关闭' };
const STATUS_STYLES: Record<string,string> = { open:'bg-amber-500/20 text-amber-400', pending:'bg-blue-500/20 text-blue-400', resolved:'bg-mint/20 text-mint', closed:'bg-gray-500/20 text-gray-400' };
const PRIORITY_STYLES: Record<string,string> = { low:'bg-green-500/20 text-green-400', normal:'bg-blue-500/20 text-blue-400', high:'bg-amber-500/20 text-amber-400', urgent:'bg-red-500/20 text-red-400' };
const PRIORITY_LABELS: Record<string,string> = { low:'低', normal:'普通', high:'高', urgent:'紧急' };

export default function SupportPage() {
  const [items, setItems] = useState<Ticket[]>([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [totalPages, setTotalPages] = useState(0); const [totalCount, setTotalCount] = useState(0);
  useEffect(() => { fetchData(); }, [currentPage, pageSize, search, statusFilter, categoryFilter]);
  const fetchData = async () => { setLoading(true); try { const params = new URLSearchParams({ page:String(currentPage), limit:String(pageSize), search, ...(statusFilter&&{status:statusFilter}), ...(categoryFilter&&{category:categoryFilter}) }); const res = await fetch(`/api/admin/support/tickets?${params}`, { credentials: 'include' }); if (!res.ok) throw new Error(); const data = await res.json(); setItems(data.items||[]); setTotalCount(data.total||0); setTotalPages(Math.ceil((data.total||0)/pageSize)); } catch { setItems([ {id:'TKT-001',userId:'u1',userName:'张三',subject:'无法登录账户',category:'account',status:'open',priority:'high',createdAt:'2024-12-01 10:00'}, {id:'TKT-002',userId:'u2',userName:'李四',subject:'提现未到账',category:'transaction',status:'pending',priority:'urgent',assignedTo:'admin1',createdAt:'2024-12-01 09:30'}, {id:'TKT-003',userId:'u3',userName:'王五',subject:'KYC审核被拒，请求复核',category:'kyc',status:'resolved',priority:'normal',assignedTo:'admin2',createdAt:'2024-11-30 15:00',resolvedAt:'2024-11-30 16:00'}, {id:'TKT-004',userId:'u4',userName:'赵六',subject:'页面加载缓慢',category:'technical',status:'closed',priority:'low',assignedTo:'admin1',createdAt:'2024-11-29 14:00',resolvedAt:'2024-11-29 15:00'}, {id:'TKT-005',userId:'u5',userName:'钱七',subject:'建议增加更多资产种类',category:'other',status:'open',priority:'low',createdAt:'2024-11-28 11:00'}, ]); setTotalCount(5); setTotalPages(1); } finally { setLoading(false); } };
  return (<AdminLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">客服工单</h1><p className="text-muted-foreground mt-1">用户咨询、投诉、技术支持工单全流程管理</p></div><Button variant="outline" onClick={fetchData} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button></div>
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总工单</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><Headphones className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待处理</p><p className="text-2xl font-bold mt-1 text-amber-400">{items.filter(i=>i.status==='open').length}</p></div><Clock className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已解决</p><p className="text-2xl font-bold mt-1 text-mint">{items.filter(i=>i.status==='resolved'||i.status==='closed').length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">紧急工单</p><p className="text-2xl font-bold mt-1 text-red-400">{items.filter(i=>i.priority==='urgent').length}</p></div><AlertCircle className="w-10 h-10 text-red-400/50" /></div></CardContent></Card>
    </div>
    <Card className="glass-strong"><CardContent className="p-6"><form onSubmit={(e)=>{e.preventDefault();setCurrentPage(1);fetchData();}} className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索用户、主题、工单号..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10" /></div>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)}><option value="">全部类别</option><option value="account">账户</option><option value="transaction">交易</option><option value="kyc">KYC</option><option value="technical">技术</option><option value="other">其他</option></select>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="">全部状态</option><option value="open">待处理</option><option value="pending">处理中</option><option value="resolved">已解决</option><option value="closed">已关闭</option></select>
      <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
    </form></CardContent></Card>
    <Card className="glass-strong"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>工单列表 (共 {totalCount} 条)</CardTitle><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><select className="px-2 py-1 rounded bg-white/5 border border-white/10" value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></div></CardHeader>
      <CardContent className="p-0">{loading?(<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>):items.length===0?(<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Headphones className="w-12 h-12 mb-4 opacity-50" /><p>暂无工单</p></div>):(
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-24">工单号</TableHead><TableHead>用户</TableHead><TableHead>主题</TableHead><TableHead className="w-24">类别</TableHead><TableHead className="w-24">优先级</TableHead><TableHead className="w-24">状态</TableHead><TableHead>处理人</TableHead><TableHead className="w-28">时间</TableHead><TableHead className="w-24">操作</TableHead></TableRow></TableHeader><TableBody>
          {items.map((t)=>(<TableRow key={t.id} className="hover:bg-white/5">
            <TableCell className="font-mono text-sm">{t.id}</TableCell>
            <TableCell><p className="font-medium">{t.userName}</p><p className="text-sm text-muted-foreground">{t.userId}</p></TableCell>
            <TableCell className="text-sm">{t.subject}</TableCell>
            <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400">{CATEGORY_LABELS[t.category]}</Badge></TableCell>
            <TableCell><Badge variant="outline" className={cn(PRIORITY_STYLES[t.priority])}>{PRIORITY_LABELS[t.priority]}</Badge></TableCell>
            <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[t.status])}>{STATUS_LABELS[t.status]}</Badge></TableCell>
            <TableCell className="text-sm">{t.assignedTo||<span className="text-muted-foreground">未分配</span>}</TableCell>
            <TableCell className="text-sm text-muted-foreground"><p>{new Date(t.createdAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>{t.resolvedAt&&<p className="text-xs text-mint">解决: {new Date(t.resolvedAt).toLocaleString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</p>}</TableCell>
            <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>window.open(`/support/${t.id}`,'_blank')}>查看详情</DropdownMenuItem>{t.status==='open'&&<DropdownMenuItem className="text-mint">分配给我</DropdownMenuItem>}{t.status==='pending'&&<DropdownMenuItem className="text-mint">标记已解决</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell>
          </TableRow>))}
        </TableBody></Table></div>)}
        {totalPages>1&&(<div className="px-4 py-4 border-t border-white/10"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} /></div>)}
      </CardContent></Card>
  </div></AdminLayout>);
}