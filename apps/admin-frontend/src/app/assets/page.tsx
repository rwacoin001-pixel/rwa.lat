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
import { Search, Filter, Eye, Edit, MoreHorizontal, RefreshCw, Plus, Building2, DollarSign, TrendingUp, Coins } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Asset {
  id: string;
  name: string;
  symbol: string;
  type: 'real_estate' | 'bond' | 'equity' | 'commodity' | 'fund';
  issuer: string;
  totalSupply: string;
  circulatingSupply: string;
  price: string;
  marketCap: string;
  status: 'active' | 'frozen' | 'pending' | 'delisted';
  chain: string;
  contractAddress: string;
  ipfsHash?: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  real_estate: '房地产',
  bond: '债券',
  equity: '股权',
  commodity: '大宗商品',
  fund: '基金',
};

const STATUS_LABELS: Record<string, string> = {
  active: '活跃',
  frozen: '冻结',
  pending: '待审核',
  delisted: '已下架',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-mint/20 text-mint',
  frozen: 'bg-red-500/20 text-red-400',
  pending: 'bg-amber-500/20 text-amber-400',
  delisted: 'bg-gray-500/20 text-gray-400',
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchAssets();
  }, [currentPage, pageSize, search, typeFilter, statusFilter]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search,
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/assets?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setAssets(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch {
      setAssets([
        { id: '1', name: '曼谷核心区公寓 Token', symbol: 'BKK-APT', type: 'real_estate', issuer: 'Thai Property Co.', totalSupply: '1,000,000', circulatingSupply: '750,000', price: '$1.25', marketCap: '$1,250,000', status: 'active', chain: 'ethereum', contractAddress: '0xabc...123', ipfsHash: 'QmX...123', createdAt: '2024-01-15' },
        { id: '2', name: '新加坡政府债券 Token', symbol: 'SGOVBOND', type: 'bond', issuer: 'SG Finance Ministry', totalSupply: '10,000,000', circulatingSupply: '8,000,000', price: '$0.95', marketCap: '$9,500,000', status: 'active', chain: 'polygon', contractAddress: '0xdef...456', createdAt: '2024-02-20' },
        { id: '3', name: '东京商业地产基金', symbol: 'TYO-RE-FUND', type: 'fund', issuer: 'Japan REIT Corp', totalSupply: '5,000,000', circulatingSupply: '3,200,000', price: '$2.80', marketCap: '$14,000,000', status: 'active', chain: 'bsc', contractAddress: '0xghi...789', createdAt: '2024-03-10' },
        { id: '4', name: '黄金锚定通证', symbol: 'GOLD-RWA', type: 'commodity', issuer: 'Global Gold Trust', totalSupply: '2,000,000', circulatingSupply: '1,500,000', price: '$50.00', marketCap: '$100,000,000', status: 'frozen', chain: 'ethereum', contractAddress: '0xjkl...012', createdAt: '2024-04-01' },
        { id: '5', name: '新兴市场股权 Token', symbol: 'EM-EQUITY', type: 'equity', issuer: 'EM Capital Group', totalSupply: '500,000', circulatingSupply: '0', price: '$10.00', marketCap: '$5,000,000', status: 'pending', chain: 'arbitrum', contractAddress: '0xmno...345', createdAt: '2024-11-28' },
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
            <h1 className="text-3xl font-bold tracking-tight">资产管理</h1>
            <p className="text-muted-foreground mt-1">RWA 资产代币全生命周期管理</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchAssets} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button>
            <Button className="flex items-center gap-2"><Plus className="w-4 h-4" />新建资产</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总资产数</p><p className="text-2xl font-bold mt-1">{totalCount}</p></div><Coins className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">活跃资产</p><p className="text-2xl font-bold mt-1 text-mint">{assets.filter(a => a.status === 'active').length}</p></div><TrendingUp className="w-10 h-10 text-mint/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">待审核</p><p className="text-2xl font-bold mt-1 text-amber-400">{assets.filter(a => a.status === 'pending').length}</p></div><Building2 className="w-10 h-10 text-amber-400/50" /></div></CardContent></Card>
          <Card className="glass-strong"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">总市值(USD)</p><p className="text-2xl font-bold mt-1 text-cyan-400">{assets.reduce((s, a) => s + parseFloat(a.marketCap.replace(/[$,]/g, '')), 0).toLocaleString()}</p></div><DollarSign className="w-10 h-10 text-cyan-400/50" /></div></CardContent></Card>
        </div>

        <Card className="glass-strong">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchAssets(); }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="搜索名称、符号、发行方..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="类型" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="real_estate">房地产</SelectItem><SelectItem value="bond">债券</SelectItem><SelectItem value="equity">股权</SelectItem><SelectItem value="commodity">大宗商品</SelectItem><SelectItem value="fund">基金</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="状态" /></SelectTrigger><SelectContent><SelectItem value="">全部</SelectItem><SelectItem value="active">活跃</SelectItem><SelectItem value="frozen">冻结</SelectItem><SelectItem value="pending">待审核</SelectItem><SelectItem value="delisted">已下架</SelectItem></SelectContent></Select>
              <Button type="submit" className="flex items-center gap-2"><Filter className="w-4 h-4" />筛选</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>资产列表 (共 {totalCount} 条)</CardTitle>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">每页</span><Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Coins className="w-12 h-12 mb-4 opacity-50" /><p>暂无资产数据</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>名称/符号</TableHead>
                    <TableHead className="w-24">类型</TableHead>
                    <TableHead>发行方</TableHead>
                    <TableHead className="w-32">价格/市值</TableHead>
                    <TableHead className="w-32">流通量/总量</TableHead>
                    <TableHead className="w-24">链</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {assets.map((a) => (
                      <TableRow key={a.id} className="hover:bg-white/5">
                        <TableCell>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{a.symbol}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400">{TYPE_LABELS[a.type]}</Badge></TableCell>
                        <TableCell className="text-sm">{a.issuer}</TableCell>
                        <TableCell>
                          <p className="font-mono tabular-nums font-medium">{a.price}</p>
                          <p className="text-xs text-muted-foreground">{a.marketCap}</p>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-sm">
                          <p>{a.circulatingSupply}</p>
                          <p className="text-xs text-muted-foreground">{a.totalSupply}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline">{a.chain}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={cn(STATUS_STYLES[a.status])}>{STATUS_LABELS[a.status]}</Badge></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/assets/${a.id}`, '_blank')}><Eye className="w-4 h-4 mr-2" />查看详情</DropdownMenuItem>
                              <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />编辑</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {a.status === 'active' && <DropdownMenuItem className="text-amber-400">冻结资产</DropdownMenuItem>}
                              {a.status === 'frozen' && <DropdownMenuItem className="text-mint">解冻资产</DropdownMenuItem>}
                              <DropdownMenuItem className="text-destructive">下架资产</DropdownMenuItem>
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