"use client";

import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  Wallet,
  Users,
  DollarSign,
  Shield,
  Activity,
  TrendingUp as TrendingUpIcon,
} from 'lucide-react';

const stats = [
  { name: '总资产管理规模', value: '$12,450,000', change: '+12.5%', icon: DollarSign, color: 'text-mint' },
  { name: '活跃用户数', value: '3,247', change: '+8.2%', icon: Users, color: 'text-cyan-400' },
  { name: '钱包余额总计', value: '$8,920,000', change: '-2.1%', icon: Wallet, color: 'text-amber-400' },
  { name: '待处理赎回', value: '23 笔', change: '+5', icon: TrendingUpIcon, color: 'text-amber-400' },
];

const recentActivity = [
  { id: 1, type: '赎回申请', user: 'user_0x1234...', amount: '50,000 USDT', status: '待审批', time: '2 分钟前' },
  { id: 2, type: 'KYC 审核', user: 'user_0x5678...', amount: '-', status: '通过', time: '15 分钟前' },
  { id: 3, type: '充值到账', user: 'user_0x9abc...', amount: '25,000 USDT', status: '完成', time: '1 小时前' },
  { id: 4, type: '提现请求', user: 'user_0xdef0...', amount: '10,000 USDT', status: '待处理', time: '3 小时前' },
  { id: 5, type: 'KYC 补件', user: 'user_0x1357...', amount: '-', status: '待补件', time: '5 小时前' },
];

const statusStyles: Record<string, string> = {
  '待审批': 'bg-amber-500/20 text-amber-400',
  '待处理': 'bg-amber-500/20 text-amber-400',
  '待补件': 'bg-amber-500/20 text-amber-400',
  '通过': 'bg-mint/20 text-mint',
  '完成': 'bg-mint/20 text-mint',
};

export default function DashboardPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">工作台</h1>
            <p className="text-muted-foreground mt-1">欢迎回来，Admin User — 实时监控平台核心指标</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="glass-strong px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v15.5a2 2 0 002 2h13a2 2 0 002-2V4" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              导出报表
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.name} className="glass-strong">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.name}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-sm font-medium mt-2" style={{ color: stat.color.replace('text-', '') }}>{stat.change}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                    <stat.icon className="w-6 h-6" style={{ color: stat.color.replace('text-', '') }} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="glass-strong rounded-xl p-6">
              <div className="flex flex-row items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">近期活动</h2>
                <button className="text-sm text-muted-foreground hover:text-white transition-colors">
                  查看全部
                </button>
              </div>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                        {activity.type === '赎回申请' && <Activity className="w-5 h-5 text-amber-400" />}
                        {activity.type === 'KYC 审核' && <Shield className="w-5 h-5 text-mint" />}
                        {activity.type === '充值到账' && <TrendingUp className="w-5 h-5 text-cyan-400" />}
                        {activity.type === '提现请求' && <Activity className="w-5 h-5 text-amber-400" />}
                        {activity.type === 'KYC 补件' && <Shield className="w-5 h-5 text-amber-400" />}
                      </div>
                      <div>
                        <p className="font-medium">{activity.type}</p>
                        <p className="text-sm text-muted-foreground">{activity.user}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">{activity.amount}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[activity.status] || 'bg-white/10 text-muted-foreground'}`}>
                        {activity.status}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats Cards */}
          <div className="space-y-6">
            <div className="glass-strong rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">系统健康度</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-mint/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-mint" />
                    </div>
                    <div>
                      <p className="font-medium">API 服务</p>
                      <p className="text-sm text-muted-foreground">正常运行</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-mint/20 text-mint px-2 py-1 rounded-full">健康</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-medium">数据库</p>
                      <p className="text-sm text-muted-foreground">连接正常</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-mint/20 text-mint px-2 py-1 rounded-full">健康</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium">Polymarket 连接</p>
                      <p className="text-sm text-muted-foreground">Gamma API 正常</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-mint/20 text-mint px-2 py-1 rounded-full">健康</span>
                </div>
              </div>
            </div>

            <div className="mt-6 glass-strong rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">待办事项</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">3 笔赎回待审批</p>
                    <p className="text-xs text-muted-foreground">最早提交于 2 分钟前</p>
                  </div>
                </li>
                <li className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">2 份 KYC 待补件</p>
                    <p className="text-xs text-muted-foreground">截止日期：今日 23:59</p>
                  </div>
                </li>
                <li className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-400/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">1 笔大额提现待人工复核</p>
                    <p className="text-xs text-muted-foreground">金额：500,000 USDT</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}