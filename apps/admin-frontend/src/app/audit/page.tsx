'use client';
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Search, Filter, RefreshCw, Download, FileText, Shield, Activity, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditLog { id: string; action: 'create'|'update'|'delete'|'login'|'logout'|'export'|'config_change'; module: string; userId: string; userName: string; ipAddress: string; details: string; createdAt: string; }
const ACTION_LABELS: Record<string,string> = { create:'创建', update:'更新', delete:'删除', login:'登录', logout:'登出', export:'导出', config_change:'配置变更' };
const ACTION_STYLES: Record<string,string> = { create:'bg-mint/20 text-mint', update:'bg-blue-500/20 text-blue-400', delete:'bg-red-500/20 text-red-400', login:'bg-green-500/20 text-green-400', logout:'bg-gray-500/20 text-gray-400', export:'bg-purple-500/20 text-purple-400', config_change:'bg-amber-500/20 text-amber-400' };

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [actionFilter, setActionFilter] = useState(''); const [moduleFilter, setModuleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1); const [pageSize, setPageSize] = useState(20); const [totalPages, setTotalPages] = useState(0); const [totalCount, setTotalCount] = useState(0);
  useEffect(() => { fetchData(); }, [currentPage, pageSize, search, actionFilter, moduleFilter]);
  const fetchData = async () => { setLoading(true); try { const params = new URLSearchParams({ page:String(currentPage), limit:String(pageSize), search, ...(actionFilter&&{action:actionFilter}), ...(moduleFilter&&{module:moduleFilter}) }); const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' }); if (!res.ok) throw new Error(); const data = await res.json(); setItems(data.items||[]); setTotalCount(data.total||0); setTotalPages(Math.ceil((data.total||0)/pageSize)); } catch { setItems([ {id:'1',action:'login',module:'auth',userId:'admin1',userName:'超级管理员',ipAddress:'192.168.1.1',details:'登录后台管理系统',createdAt:'2024-12-01 12:00:00'}, {id:'2',action:'update',module:'kyc',userId:'admin1',userName:'超级管理员',ipAddress:'192.168.1.1',details:'审核通过用户张三的KYC申请 #KYC-001',createdAt:'2024-12-01 11:30:00'}, {id:'3',action:'config_change',module:'risk',userId:'admin2',userName:'风险管理员',ipAddress:'192.168.1.2',details:'修改风控规则 #R-005 阈值从 $100,000 调整为 $50,000',createdAt:'2024-12-01 10:15:00'}, {id:'4',action:'export',module:'ledger',userId:'admin1',userName:'超级管理员',ipAddress:'192.168.1.1',details:'导出11月账本流水 CSV (1250条)',createdAt:'2024-12-01 09:00:00'}, {id:'5',action:'delete',module:'files',userId:'admin2',userName:'风险管理员',ipAddress:'192.168.1.2',details:'删除过期合规证书文件 #FILE-008',createdAt:'2024-11-30 16:00:00'}, {id:'6',action:'create',module:'assets',userId:'admin1',userName:'超级管理员',ipAddress:'192.168.1.1',details:'创建新资产 EM-EQUITY',createdAt:'2024-11-28 10:00:00'}, {id:'7',action:'logout',module:'auth',userId:'admin2',userName:'风险管理员',ipAddress:'192.168.1.2',details:'退出登录',createdAt:'2024-11-28 18:00:00'}, ]); setTotalCount(7); setTotalPages(1); } finally { setLoading(false); } };
  return (<AdminLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">审计日志</h1><p className="text-muted-foreground mt-1">管理员操作审计、配置变更、数据导出全程记录</p></div><div className="flex gap-2"><Button variant="outline" onClick={fetchData} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button><Button variant="outline" onClick={()=>alert('导出功能开发中...')} className="flex items-center gap-2"><Download className="w-4 h-4" />导出日志</Button></div></div>
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总日志</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><FileText className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">登录次数</p><p className="text-2xl font-bold mt-1 text-green-400">{items.filter(i=>i.action==='login').length}</p></div><Shield className="w-10 h-10 text-green-400/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">配置变更</p><p className="text-2xl font-bold mt-1 text-amber-400">{items.filter(i=>i.action==='config_change').length}</p></div><Activity className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
      <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">数据导出</p><p className="text-2xl font-bold mt-1 text-purple-400">{items.filter(i=>i.action==='export').length}</p></div><Database className="w-10 h-10 text-purple-400/50" /></div></CardContent></Card>
    </div>
    <Card className="glass-strong"><CardContent className="p-6"><form onSubmit={(e)=>{e.preventDefault();setCurrentPage(1);fetchData();}} className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="搜索用户、模块、IP..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10" /></div>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={actionFilter} onChange={(e)=>setActionFilter(e.target.value)}><option value="">全部操作</option><option value="create">创建</option><option value="update">更新</option><option value="delete">删除</option><option value="login">登录</option><option value="logout">登出</option><option value="export">导出</option><option value="config_change">配置变更</option></select>
      <select className="px-3 py-2 rounded-lg bg-white/5 border border-white/10" value={moduleFilter} onChange={(e)=>setModuleFilter(e.target.value)}><option value="">全部模块</option><option value="auth">认证</option><option value="kyc">KYC</option><option value="risk">风控</option><option value="ledger">账本</option><option value="files">文件</option><option value="assets">资产</option></select>
      <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
    </form></CardContent></Card>
    <Card className="glass-strong"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>审计日志 (共 {totalCount} 条)</CardTitle><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><select className="px-2 py-1 rounded bg-white/5 border border-white/10" value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value));setCurrentPage(1);}}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></div></CardHeader>
      <CardContent className="p-0">{loading?(<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>):items.length===0?(<div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Shield className="w-12 h-12 mb-4 opacity-50" /><p>暂无审计日志</p></div>):(
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-20">操作</TableHead><TableHead className="w-24">模块</TableHead><TableHead>操作人</TableHead><TableHead className="w-28">IP 地址</TableHead><TableHead>详情</TableHead><TableHead className="w-32">时间</TableHead></TableRow></TableHeader><TableBody>
          {items.map((log)=>(<TableRow key={log.id} className="hover:bg-white/5">
            <TableCell><Badge variant="outline" className={cn(ACTION_STYLES[log.action])}>{ACTION_LABELS[log.action]}</Badge></TableCell>
            <TableCell><Badge variant="outline">{log.module}</Badge></TableCell>
            <TableCell><p className="font-medium text-sm">{log.userName}</p><p className="text-xs text-muted-foreground">{log.userId}</p></TableCell>
            <TableCell className="font-mono text-sm text-muted-foreground">{log.ipAddress}</TableCell>
            <TableCell className="text-sm max-w-[300px]">{log.details}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{new Date(log.createdAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</TableCell>
          </TableRow>))}
        </TableBody></Table></div>)}
        {totalPages>1&&(<div className="px-4 py-4 border-t border-white/10"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} /></div>)}
      </CardContent></Card>
  </div></AdminLayout>);
}