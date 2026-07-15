'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Activity, Wifi, WifiOff, Clock, Database, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NetworkStatus {
  chain: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'tron' | 'solana';
  displayName: string;
  status: 'healthy' | 'degraded' | 'down' | 'maintenance';
  rpcUrl: string;
  latestBlock: number;
  blockTime: number; // seconds
  lastBlockAt: string;
  gasPrice: string;
  gasPriceUsd: string;
  pendingTransactions: number;
  successRate24h: number; // percentage
  avgConfirmationTime: number; // seconds
  walletCount: number;
  dailyVolumeUsd: string;
  isSyncing: boolean;
  peerCount: number;
  alerts: string[];
}

const CHAIN_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
  ethereum: { name: 'Ethereum', color: 'bg-blue-500', icon: 'Ξ' },
  polygon: { name: 'Polygon', color: 'bg-purple-500', icon: 'M' },
  bsc: { name: 'BSC', color: 'bg-yellow-500', icon: 'B' },
  arbitrum: { name: 'Arbitrum', color: 'bg-blue-400', icon: 'A' },
  optimism: { name: 'Optimism', color: 'bg-red-500', icon: 'O' },
  tron: { name: 'TRON', color: 'bg-pink-500', icon: 'T' },
  solana: { name: 'Solana', color: 'bg-green-500', icon: 'S' },
};

const STATUS_LABELS: Record<string, string> = {
  healthy: '健康',
  degraded: '降级',
  down: '故障',
  maintenance: '维护中',
};

const STATUS_STYLES: Record<string, string> = {
  healthy: 'bg-mint/20 text-mint',
  degraded: 'bg-amber-500/20 text-amber-400',
  down: 'bg-red-500/20 text-red-400',
  maintenance: 'bg-blue-500/20 text-blue-400',
};

export default function NetworksPage() {
  const [networks, setNetworks] = useState<NetworkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  useEffect(() => {
    fetchNetworks();
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchNetworks, refreshInterval * 1000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const fetchNetworks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/networks/status`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('获取网络状态失败');
      
      const data = await res.json();
      setNetworks(data.items || []);
    } catch (err) {
      console.error('Failed to fetch network status:', err);
      // Fallback mock data
      setNetworks([
        { chain: 'ethereum', displayName: 'Ethereum Mainnet', status: 'healthy', rpcUrl: 'https://eth.llamarpc.com', latestBlock: 18901234, blockTime: 12, lastBlockAt: '2024-12-01 12:00:30', gasPrice: '25 Gwei', gasPriceUsd: '$1.25', pendingTransactions: 45000, successRate24h: 99.2, avgConfirmationTime: 15, walletCount: 1250, dailyVolumeUsd: '$12,500,000', isSyncing: false, peerCount: 25, alerts: [] },
        { chain: 'polygon', displayName: 'Polygon PoS', status: 'healthy', rpcUrl: 'https://polygon.llamarpc.com', latestBlock: 56789012, blockTime: 2, lastBlockAt: '2024-12-01 12:00:28', gasPrice: '30 Gwei', gasPriceUsd: '$0.03', pendingTransactions: 12000, successRate24h: 99.8, avgConfirmationTime: 4, walletCount: 980, dailyVolumeUsd: '$8,200,000', isSyncing: false, peerCount: 18, alerts: [] },
        { chain: 'bsc', displayName: 'BNB Smart Chain', status: 'degraded', rpcUrl: 'https://bsc.llamarpc.com', latestBlock: 34567890, blockTime: 3, lastBlockAt: '2024-12-01 12:00:25', gasPrice: '5 Gwei', gasPriceUsd: '$0.015', pendingTransactions: 8000, successRate24h: 98.5, avgConfirmationTime: 5, walletCount: 750, dailyVolumeUsd: '$5,100,000', isSyncing: false, peerCount: 15, alerts: ['Gas 价格波动较大'] },
        { chain: 'arbitrum', displayName: 'Arbitrum One', status: 'healthy', rpcUrl: 'https://arbitrum.llamarpc.com', latestBlock: 234567890, blockTime: 0.25, lastBlockAt: '2024-12-01 12:00:30', gasPrice: '0.1 Gwei', gasPriceUsd: '$0.001', pendingTransactions: 5000, successRate24h: 99.9, avgConfirmationTime: 1, walletCount: 620, dailyVolumeUsd: '$3,800,000', isSyncing: false, peerCount: 12, alerts: [] },
        { chain: 'optimism', displayName: 'Optimism', status: 'healthy', rpcUrl: 'https://optimism.llamarpc.com', latestBlock: 123456789, blockTime: 2, lastBlockAt: '2024-12-01 12:00:28', gasPrice: '0.01 Gwei', gasPriceUsd: '$0.0001', pendingTransactions: 2000, successRate24h: 99.7, avgConfirmationTime: 3, walletCount: 380, dailyVolumeUsd: '$1,200,000', isSyncing: false, peerCount: 10, alerts: [] },
        { chain: 'tron', displayName: 'TRON Mainnet', status: 'healthy', rpcUrl: 'https://api.trongrid.io', latestBlock: 56789012, blockTime: 3, lastBlockAt: '2024-12-01 12:00:27', gasPrice: '28 Sun', gasPriceUsd: '$0.0007', pendingTransactions: 3000, successRate24h: 99.6, avgConfirmationTime: 5, walletCount: 450, dailyVolumeUsd: '$2,500,000', isSyncing: false, peerCount: 8, alerts: [] },
        { chain: 'solana', displayName: 'Solana Mainnet', status: 'healthy', rpcUrl: 'https://api.mainnet-beta.solana.com', latestBlock: 234567890, blockTime: 0.4, lastBlockAt: '2024-12-01 12:00:30', gasPrice: '5000 Lamports', gasPriceUsd: '$0.00005', pendingTransactions: 15000, successRate24h: 99.9, avgConfirmationTime: 1, walletCount: 320, dailyVolumeUsd: '$1,800,000', isSyncing: false, peerCount: 20, alerts: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: string, network: NetworkStatus) => {
    switch (action) {
      case 'restart':
        if (confirm(`确定重启 ${network.displayName} RPC 节点吗？`)) {
          // TODO: API call
        }
        break;
      case 'maintanence':
        if (confirm(`确定将 ${network.displayName} 设为维护模式吗？`)) {
          // TODO: API call
        }
        break;
      case 'viewLogs':
        window.open(`/networks/${network.chain}/logs`, '_blank');
        break;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">网络状态监控</h1>
            <p className="text-muted-foreground mt-1">多链 RPC 健康、区块同步、Gas 价格、交易成功率实时监控</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm">自动刷新</label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="toggle toggle-sm"
              />
            </div>
            {autoRefresh && (
              <Select value={String(refreshInterval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10s</SelectItem>
                  <SelectItem value="30">30s</SelectItem>
                  <SelectItem value="60">60s</SelectItem>
                  <SelectItem value="300">5m</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button onClick={fetchNetworks} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">健康链</p>
                  <p className="text-2xl font-bold mt-1 text-mint">{networks.filter(n => n.status === 'healthy').length}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-mint/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">降级/故障</p>
                  <p className="text-2xl font-bold mt-1 text-amber-400">{networks.filter(n => n.status === 'degraded' || n.status === 'down').length}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-amber-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">平均成功率(24h)</p>
                  <p className="text-2xl font-bold mt-1 text-cyan-400">
                    {(networks.reduce((sum, n) => sum + n.successRate24h, 0) / networks.length || 0).toFixed(1)}%
                  </p>
                </div>
                <Activity className="w-10 h-10 text-cyan-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-strong">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总日交易量(USD)</p>
                  <p className="text-2xl font-bold mt-1 text-purple-400">
                    {networks.reduce((sum, n) => sum + parseFloat(n.dailyVolumeUsd.replace(/[$,]/g, '')), 0).toLocaleString()}
                  </p>
                </div>
                <ArrowRight className="w-10 h-10 text-purple-400/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Network Status Table */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>链状态详情</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">链</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-32">最新区块</TableHead>
                      <TableHead className="w-32">出块时间</TableHead>
                      <TableHead className="w-36">Gas 价格</TableHead>
                      <TableHead className="w-32">待处理 TX</TableHead>
                      <TableHead className="w-28">成功率(24h)</TableHead>
                      <TableHead className="w-32">确认时间</TableHead>
                      <TableHead className="w-24">钱包数</TableHead>
                      <TableHead className="w-36">日交易量(USD)</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networks.map((n) => (
                      <TableRow key={n.chain} className="hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold', CHAIN_CONFIG[n.chain]?.color || 'bg-gray-500')}>
                              {CHAIN_CONFIG[n.chain]?.icon || n.chain[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{n.displayName}</p>
                              <p className="text-xs text-muted-foreground font-mono">{n.rpcUrl}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(STATUS_STYLES[n.status])}>
                            {STATUS_LABELS[n.status]}
                          </Badge>
                          {n.isSyncing && (
                            <p className="text-xs text-amber-400 mt-1">同步中...</p>
                          )}
                          {n.alerts.length > 0 && (
                            <p className="text-xs text-red-400 mt-1">{n.alerts[0]}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-mono tabular-nums font-medium">{n.latestBlock.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{new Date(n.lastBlockAt).toLocaleTimeString('zh-CN')}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono tabular-nums">{n.blockTime}s</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-mono tabular-nums font-medium">{n.gasPrice}</p>
                            <p className="text-xs text-muted-foreground">{n.gasPriceUsd}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono tabular-nums">{n.pendingTransactions.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn('font-mono tabular-nums font-medium', n.successRate24h >= 99 ? 'text-mint' : n.successRate24h >= 95 ? 'text-amber-400' : 'text-red-400')}>
                              {n.successRate24h}%
                            </span>
                            {n.successRate24h >= 99 ? (
                              <CheckCircle className="w-4 h-4 text-mint" />
                            ) : n.successRate24h >= 95 ? (
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono tabular-nums">{n.avgConfirmationTime}s</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono tabular-nums">{n.walletCount.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono tabular-nums text-cyan-400">{n.dailyVolumeUsd}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction('viewLogs', n)}>
                              <Database className="w-4 h-4" />
                            </Button>
                            {n.status !== 'maintenance' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction('maintanence', n)}>
                                <WifiOff className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}