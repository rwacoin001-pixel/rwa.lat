'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, StatChip, StatusPill, formatDateTime, useApi } from '@/components/console/framework'
import { CloudDownload } from 'lucide-react'

type Stats = {
  counts: { markets: number; tokens: number; orders: number; settlements: number }
  watermarks: Array<{
    provider: string
    stream: string
    state: string
    cursor: string | null
    lastEventAt: string | null
    lastSuccessAt: string | null
    consecutiveFailures: number
    lastErrorCode: string | null
    updatedAt: string
  }>
}

export default function PolymarketPage() {
  const stats = useApi<Stats>('/api/admin/console/polymarket/stats')
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState('')

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 8000)
  }

  const sync = async () => {
    if (!window.confirm('从 Polymarket Gamma API 同步市场数据？')) return
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/polymarket/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `同步失败 (HTTP ${res.status})`)
      showNotice(`市场同步完成${body && typeof body === 'object' && 'upserted' in body ? `：更新 ${String((body as Record<string, unknown>).upserted)} 个市场` : ''}`)
      stats.reload()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const watermarkColumns: Col<Stats['watermarks'][number]>[] = [
    { key: 'provider', label: '提供方', render: (row) => <span className="font-medium">{row.provider}</span> },
    { key: 'stream', label: '数据流', render: (row) => <span className="font-mono text-xs">{row.stream}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state === 'ok' || row.state === 'idle' ? 'active' : row.state} /> },
    { key: 'cursor', label: '游标', render: (row) => <span className="font-mono text-[11px] text-text-faint">{row.cursor ? `${row.cursor.slice(0, 24)}…` : '—'}</span> },
    { key: 'lastSuccessAt', label: '最近成功', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.lastSuccessAt)}</span> },
    {
      key: 'failures',
      label: '连续失败',
      render: (row) => (
        <span className={row.consecutiveFailures > 0 ? 'font-medium tabular-nums text-amber-600' : 'tabular-nums text-text-faint'}>{row.consecutiveFailures}</span>
      ),
    },
    { key: 'lastErrorCode', label: '最近错误', render: (row) => <span className="text-xs text-rose-600">{row.lastErrorCode ?? '—'}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="预测市场"
          subtitle="Polymarket 外部市场映射与同步水位（Gamma API）— 交易功能保持关闭，仅做数据面"
          actions={
            <>
              <button
                type="button"
                disabled={syncing}
                onClick={() => void sync()}
                className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110 disabled:opacity-60"
              >
                <CloudDownload className={syncing ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
                {syncing ? '同步中…' : '同步市场'}
              </button>
              <RefreshButton loading={stats.loading} onClick={stats.reload} />
            </>
          }
        />

        {notice && <div className="animate-pop rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{notice}</div>}

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatChip label="市场映射" value={stats.data?.counts.markets ?? '…'} delay={40} />
          <StatChip label="Token 映射" value={stats.data?.counts.tokens ?? '…'} delay={90} />
          <StatChip label="订单映射" value={stats.data?.counts.orders ?? '…'} delay={140} />
          <StatChip label="结算映射" value={stats.data?.counts.settlements ?? '…'} delay={190} />
        </div>

        <Panel title="同步水位（watermarks）" subtitle="每个数据流的游标推进与失败计数；连续失败会自动退避" delay={220} pad={false}>
          <div className="px-5 pb-5">
            <DataTable
              columns={watermarkColumns}
              rows={stats.data?.watermarks ?? null}
              loading={stats.loading}
              error={stats.error}
              onReload={stats.reload}
              emptyHint="暂无同步记录 — 点击「同步市场」初始化"
            />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
