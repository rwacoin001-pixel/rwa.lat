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
import { Search, Filter, Eye, MoreHorizontal, RefreshCw, Plus, FileText, Download, Upload, CheckCircle, Clock, FileCheck } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface FileRecord {
  id: string;
  name: string;
  type: 'legal' | 'audit' | 'compliance' | 'contract' | 'certificate' | 'disclosure';
  category: string;
  fileSize: string;
  mimeType: string;
  uploaderId: string;
  uploaderName: string;
  relatedAssetId: string;
  relatedAssetName: string;
  ipfsHash: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  uploadedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  legal: '法律文件',
  audit: '审计报告',
  compliance: '合规证书',
  contract: '合同',
  certificate: '资质证书',
  disclosure: '披露文件',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待验证',
  verified: '已验证',
  rejected: '已拒绝',
  expired: '已过期',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  verified: 'bg-mint/20 text-mint',
  rejected: 'bg-red-500/20 text-red-400',
  expired: 'bg-gray-500/20 text-gray-400',
};

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchFiles();
  }, [currentPage, pageSize, search, typeFilter, statusFilter]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/files?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setFiles(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch {
      setFiles([
        { id: '1', name: '曼谷公寓项目法律意见书.pdf', type: 'legal', category: '房地产', fileSize: '2.5 MB', mimeType: 'application/pdf', uploaderId: 'admin1', uploaderName: '管理员A', relatedAssetId: 'a1', relatedAssetName: 'BKK-APT', ipfsHash: 'QmX...123', status: 'verified', uploadedAt: '2024-01-15' },
        { id: '2', name: '新加坡政府债券审计报告.pdf', type: 'audit', category: '债券', fileSize: '5.2 MB', mimeType: 'application/pdf', uploaderId: 'admin2', uploaderName: '管理员B', relatedAssetId: 'a2', relatedAssetName: 'SGOVBOND', ipfsHash: 'QmY...456', status: 'verified', uploadedAt: '2024-02-20' },
        { id: '3', name: '日本REIT合规证书.pdf', type: 'compliance', category: '基金', fileSize: '1.8 MB', mimeType: 'application/pdf', uploaderId: 'admin1', uploaderName: '管理员A', relatedAssetId: 'a3', relatedAssetName: 'TYO-RE-FUND', ipfsHash: 'QmZ...789', status: 'pending', uploadedAt: '2024-03-10' },
        { id: '4', name: '黄金信托合同.pdf', type: 'contract', category: '大宗商品', fileSize: '3.1 MB', mimeType: 'application/pdf', uploaderId: 'admin2', uploaderName: '管理员B', relatedAssetId: 'a4', relatedAssetName: 'GOLD-RWA', ipfsHash: 'QmW...012', status: 'verified', uploadedAt: '2024-04-01' },
        { id: '5', name: 'EM Capital 披露文件.pdf', type: 'disclosure', category: '股权', fileSize: '4.0 MB', mimeType: 'application/pdf', uploaderId: 'admin1', uploaderName: '管理员A', relatedAssetId: 'a5', relatedAssetName: 'EM-EQUITY', ipfsHash: 'QmV...345', status: 'rejected', uploadedAt: '2024-11-28' },
      ]);
      setTotalCount(5);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">文件管理</h1>
            <p className="text-muted-foreground mt-1">法律文件、审计报告、合规证书、IPFS 存证管理</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchFiles} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button>
            <Button className="flex items-center gap-2"><Upload className="w-4 h-4" />上传文件</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总文件数</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><FileText className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">已验证</p><p className="text-2xl font-bold mt-1 text-mint">{files.filter(f => f.status === 'verified').length}</p></div><CheckCircle className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待验证</p><p className="text-2xl font-bold mt-1 text-amber-400">{files.filter(f => f.status === 'pending').length}</p></div><Clock className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">IPFS 存证</p><p className="text-2xl font-bold mt-1 text-cyan-400">{files.filter(f => f.ipfsHash).length}</p></div><FileCheck className="w-10 h-10 text-cyan-400/50" /></div></CardContent></Card>
        </div>

        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchFiles(); }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="搜索文件名、IPFS Hash、资产..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="类型" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="legal">法律文件</SelectItem><SelectItem value="audit">审计报告</SelectItem><SelectItem value="compliance">合规证书</SelectItem><SelectItem value="contract">合同</SelectItem><SelectItem value="certificate">资质证书</SelectItem><SelectItem value="disclosure">披露文件</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="状态" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="pending">待验证</SelectItem><SelectItem value="verified">已验证</SelectItem><SelectItem value="rejected">已拒绝</SelectItem><SelectItem value="expired">已过期</SelectItem></SelectContent></Select>
              <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>文件列表 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><FileText className="w-12 h-12 mb-4 opacity-50" /><p>暂无文件数据</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>文件名</TableHead>
                    <TableHead className="w-24">类型</TableHead>
                    <TableHead>关联资产</TableHead>
                    <TableHead className="w-24">大小</TableHead>
                    <TableHead>上传者</TableHead>
                    <TableHead className="w-28">IPFS Hash</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-28">上传时间</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {files.map((f) => (
                      <TableRow key={f.id} className="hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div><p className="font-medium text-sm truncate max-w-[200px]">{f.name}</p><p className="text-xs text-muted-foreground">{f.mimeType}</p></div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400">{TYPE_LABELS[f.type]}</Badge></TableCell>
                        <TableCell><p className="font-medium text-sm">{f.relatedAssetName}</p><p className="text-xs text-muted-foreground">{f.relatedAssetId}</p></TableCell>
                        <TableCell className="font-mono tabular-nums text-sm">{f.fileSize}</TableCell>
                        <TableCell><p className="text-sm">{f.uploaderName}</p><p className="text-xs text-muted-foreground">{f.uploaderId}</p></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[100px]">{f.ipfsHash}</TableCell>
                        <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[f.status])}>{STATUS_LABELS[f.status]}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(f.uploadedAt).toLocaleDateString('zh-CN')}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/files/${f.id}`, '_blank')}><Eye className="w-4 h-4 mr-2" />查看详情</DropdownMenuItem>
                              <DropdownMenuItem><Download className="w-4 h-4 mr-2" />下载</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {f.status === 'pending' && <DropdownMenuItem className="text-mint"><CheckCircle className="w-4 h-4 mr-2" />验证通过</DropdownMenuItem>}
                              {f.status === 'pending' && <DropdownMenuItem className="text-destructive">拒绝</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => window.open(`https://ipfs.io/ipfs/${f.ipfsHash}`, '_blank')}>IPFS 查看</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="px-4 py-4 border-t border-white/10">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} showPageSize pageSize={pageSize} onPageSizeChange={setPageSize} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}