'use client';
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, Eye, RefreshCw, Brain, CheckCircle, Clock, DollarSign, Cpu } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface AITask { id: string; taskName: string; taskType: 'content_generation'|'risk_assessment'|'user_segmentation'|'report_generation'|'anomaly_detection'; status: 'idle'|'running'|'completed'|'failed'; model: string; tokensUsed: number; costUsd: string; startedAt: string; completedAt?: string; result?: string; }
const TYPE_LABELS: Record<string,string> = { content_generation:'内容生成', risk_assessment:'风控评估', user_segmentation:'用户分群', report_generation:'报告生成', anomaly_detection:'异常检测' };
const STATUS_LABELS: Record<string,string> = { idle:'空闲', running:'运行中', completed:'已完成', failed:'失败' };
const STATUS_STYLES: Record<string,string> = { idle:'bg-gray-500/20 text-gray-400', running:'bg-blue-500/20 text-blue-400', completed:'bg-mint/20 text-mint', failed:'bg-red-500/20 text-red-400' };

export default function AiOpsPage() {
  const [items, setItems] = useState<AITask[]>([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [totalPages, setTotalPages] = useState(0); const [totalCount, setTotalCount] = useState(0);
  useEffect(() => { fetchData(); }, [currentPage, pageSize, search, statusFilter, typeFilter]);
  const fetchData = async () => { setLoading(true); try { const params = new URLSearchParams({ page:String(currentPage), limit:String(pageSize), search, ...(statusFilter&&{status:statusFilter}), ...(typeFilter&&{type:typeFilter}) }); const res = await fetch(`/api/admin/ai-ops?${params}`, { credentials: 'include' }); if (!res.ok) throw new Error(); const data = await res.json(); setItems(data.items||[]); setTotalCount(data.total||0); setTotalPages(Math.ceil((data.total||0)/pageSize)); } catch { setItems([ {id:'ai-001',taskName:'每日市场分析报告生成',taskType:'report_generation',status:'completed',model:'gpt-4o',tokensUsed:15000,costUsd:'$0.45',startedAt:'2024-12-01 06:00',completedAt:'2024-12-01 06:05',result:'已生成2024-12-01市场分析报告'}, {id:'ai-002',taskName:'异常交易模式检测',taskType:'anomaly_detection',status:'running',model:'claude-3-sonnet',tokensUsed:8500,costUsd:'$0.13',startedAt:'2024-12-01 12:00'}, {id:'ai-003',taskName:'高价值用户分群分析',taskType:'user_segmentation',status:'completed',model:'gpt-4o',tokensUsed:25000,costUsd:'$0.75',startedAt:'2024-11-30 18:00',completedAt:'2024-11-30 18:15',result:'分群完成: 5个高价值群体'}, {id:'ai-004',taskName:'自动风控评估-批量',taskType:'risk_assessment',status:'failed',model:'deepseek-v3',tokensUsed:3200,costUsd:'$0.03',startedAt:'2024-11-30 10:00',result:'API超时'}, {id:'ai-005',taskName:'营销文案自动生成',taskType:'content_generation',status:'idle',model:'gpt-4o',tokensUsed:0,costUsd:'$0.00',startedAt:'2024-11-29 14:00',completedAt:'2024-11-29 14:10',result:'生成3条营销推文'}, ]); setTotalCount(5); setTotalPages(1); } finally { setLoading(false); } };
  return (<AdminLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">AI 运营管理</h1><p className="text-muted-foreground mt-1">AI 任务调度、模型消耗、Token 成本、运行状态监控</p></div><Button variant="outline" onClick={fetchData} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button></div>
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总任务</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><Brain className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">运行中</p><p className="text-2xl font-bold mt-1 text-blue-400">{items.filter(i=>i.status==='running').length}</p></div><Cpu className="w-10 h-10 text-blue-400/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已完成</p><p className="text-2xl font-bold mt-1 text-mint">{items.filter(i=>i.status==='completed').length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总成本(USD)</p><p className="text-2xl font-bold mt-1 text-cyan-400">{items.reduce((s,i)=>s+parseFloat(i.costUsd.replace('$','')),0).toFixed(2)}</p></div><DollarSign className="w-10 h-10 text-cyan-400/50" /></div></CardContent></Card>
    </div>
    <Card className="glass-strong"><CardContent className="p-6"><form onSubmit={(e)=>{e.preventDefault();setCurrentPage(1);fetchData();}} className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索任务名称、模型..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10" /></div>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}><option value="">全部类型</option><option value="content_generation">内容生成</option><option value="risk_assessment">风控评估</option><option value="user_segmentation">用户分群</option><option value="report_generation">报告生成</option><option value="anomaly_detection">异常检测</option></select>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="">全部状态</option><option value="idle">空闲</option><option value="running">运行中</option><option value="completed">已完成</option><option value="failed">失败</option></select>
      <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
    </form></CardContent></Card>
    <Card className="glass-strong"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>AI任务列表 (共 {totalCount} 条)</CardTitle><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><select className="px-2 py-1 rounded bg-white/5 border border-white/10" value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></div></CardHeader>
      <CardContent className="p-0">{loading?(<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>):items.length===0?(<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Brain className="w-12 h-12 mb-4 opacity-50" /><p>暂无AI任务</p></div>):(
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>任务名称</TableHead><TableHead className="w-28">类型</TableHead><TableHead className="w-28">模型</TableHead><TableHead className="w-24">Tokens</TableHead><TableHead className="w-20">成本</TableHead><TableHead className="w-24">状态</TableHead><TableHead className="w-28">时间</TableHead><TableHead className="w-24">操作</TableHead></TableRow></TableHeader><TableBody>
          {items.map((t)=>(<TableRow key={t.id} className="hover:bg-white/5">
            <TableCell><p className="font-medium">{t.taskName}</p>{t.result&&<p className="text-xs text-muted-foreground truncate max-w-[200px]">结果: {t.result}</p>}</TableCell>
            <TableCell><Badge variant="outline" className="bg-purple-500/20 text-purple-400">{TYPE_LABELS[t.taskType]}</Badge></TableCell>
            <TableCell><Badge variant="outline">{t.model}</Badge></TableCell>
            <TableCell className="font-mono tabular-nums">{t.tokensUsed.toLocaleString()}</TableCell>
            <TableCell className="font-mono tabular-nums text-cyan-400">{t.costUsd}</TableCell>
            <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[t.status])}>{STATUS_LABELS[t.status]}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground"><p>{new Date(t.startedAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>{t.completedAt&&<p className="text-xs text-mint">完成: {new Date(t.completedAt).toLocaleString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</p>}</TableCell>
            <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>window.open(`/ai-ops/${t.id}`,'_blank')}>查看详情</DropdownMenuItem>{t.status==='failed'&&<DropdownMenuItem className="text-mint">重试任务</DropdownMenuItem>}{t.status==='running'&&<DropdownMenuItem className="text-amber-400">停止任务</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell>
          </TableRow>))}
        </TableBody></Table></div>)}
        {totalPages>1&&(<div className="px-4 py-4 border-t border-white/10"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} /></div>)}
      </CardContent></Card>
  </div></AdminLayout>);
}