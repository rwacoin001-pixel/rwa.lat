'use client'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, Panel, RefreshButton, useApi } from '@/components/console/framework'
import { cn } from '@/lib/utils'
import { Boxes, Cloud, Database, LineChart, Server, ShieldCheck, Sparkles } from 'lucide-react'

type Health = { status: string; app: string; time: string }

const INTEGRATIONS = [
  {
    name: 'CoinMarketCap',
    role: 'RWA 资产目录与行情数据源',
    detail: '每日全量目录 + 每小时行情快照（免费档限速 27 req/min，客户端内置节流与 429 退避）',
    icon: LineChart,
    tone: 'text-mint',
    href: '/assets',
    hrefLabel: '查看资产目录',
  },
  {
    name: 'Didit',
    role: 'KYC 身份认证服务商',
    detail: '托管认证流程 + Webhook 回调写入 KYC 档案（证件信息加密落库）',
    icon: ShieldCheck,
    tone: 'text-emerald-600',
    href: '/kyc',
    hrefLabel: '查看 KYC 档案',
  },
  {
    name: 'Backblaze B2',
    role: '对象存储（文件/披露/附件）',
    detail: 'S3 兼容存储，上传走预签名直传 + 安全扫描状态跟踪',
    icon: Boxes,
    tone: 'text-sky-600',
    href: '/files',
    hrefLabel: '查看文件管理',
  },
  {
    name: 'DeepSeek',
    role: 'AI 分析引擎',
    detail: '资产分析（摘要/多空论点/风险提示）与社区翻译',
    icon: Sparkles,
    tone: 'text-violet-600',
    href: '/ai-ops',
    hrefLabel: '查看 AI 分析',
  },
  {
    name: 'Polymarket Gamma',
    role: '预测市场数据同步',
    detail: '市场/Token 映射与同步水位管理；交易功能保持关闭',
    icon: Cloud,
    tone: 'text-amber-600',
    href: '/polymarket',
    hrefLabel: '查看同步状态',
  },
  {
    name: 'Render',
    role: '应用托管（核心 API / 管理台 / Worker）',
    detail: '核心 API、管理 API、管理前端与社区服务运行于 Render；数据库为 Neon PostgreSQL',
    icon: Server,
    tone: 'text-slate-600',
  },
  {
    name: 'Neon PostgreSQL',
    role: '主数据库',
    detail: '核心库 + 管理库 + 测试库；迁移随部署自动执行',
    icon: Database,
    tone: 'text-slate-600',
  },
]

export default function ProvidersPage() {
  const health = useApi<Health>('/api/admin/health')

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="服务商"
          subtitle="外部集成与基础设施依赖清单"
          actions={<RefreshButton loading={health.loading} onClick={health.reload} />}
        />

        <Panel title="服务运行状态" delay={40}>
          <div className="flex items-center gap-3">
            <span className={cn('h-2.5 w-2.5 rounded-full', health.data?.status === 'ok' ? 'bg-emerald-500' : health.error ? 'bg-rose-500' : 'bg-amber-500')} />
            <span className="text-sm font-medium">管理 API（{health.data?.app ?? 'rwa-lat-admin'}）{health.data?.status === 'ok' ? '正常' : health.error ? '不可达' : '检测中…'}</span>
            <span className="text-xs text-text-faint">{health.data ? `服务器时间 ${new Date(health.data.time).toLocaleString('zh-CN')}` : ''}</span>
          </div>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INTEGRATIONS.map((integration, index) => (
            <section key={integration.name} className="glass-strong card-lift animate-rise flex flex-col rounded-card p-5" style={{ animationDelay: `${60 + index * 50}ms` }}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink/[0.04]">
                  <integration.icon className={cn('h-5 w-5', integration.tone)} />
                </span>
                <div>
                  <p className="font-semibold">{integration.name}</p>
                  <p className="text-xs text-text-faint">{integration.role}</p>
                </div>
              </div>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-text-secondary">{integration.detail}</p>
              {integration.href && (
                <a href={integration.href} className="mt-3 inline-flex w-fit items-center gap-1 text-xs font-medium text-mint transition-colors hover:text-accent-2">
                  {integration.hrefLabel} →
                </a>
              )}
            </section>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
