'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { Send } from 'lucide-react'

type NotificationRow = {
  id: string
  recipientUserId: string
  channel: string
  kind: string
  title: string
  body?: string | null
  readAt?: string | null
  createdAt: string
}

const CHANNELS = [
  { value: 'in_app', label: '站内（in_app）' },
  { value: 'email', label: '邮件（email）' },
  { value: 'sms', label: '短信（sms）' },
  { value: 'push', label: '推送（push）' },
]

export default function NotificationsPage() {
  const list = useApi<NotificationRow[]>('/api/admin/notifications?limit=100')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ recipientUserId: '', channel: 'in_app', kind: 'system', title: '', body: '' })

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 7000)
  }

  const send = async () => {
    if (!form.recipientUserId.trim() || !form.title.trim()) {
      showNotice('请填写用户 ID 与标题')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipient_user_id: form.recipientUserId.trim(),
          channel: form.channel,
          kind: form.kind.trim() || 'system',
          title: form.title.trim(),
          body: form.body.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data?.message as string) || `发送失败 (HTTP ${res.status})`)
      showNotice('通知已创建')
      setForm((prev) => ({ ...prev, title: '', body: '' }))
      list.reload()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  const columns: Col<NotificationRow>[] = [
    {
      key: 'title',
      label: '通知',
      render: (row) => (
        <span>
          <span className="block font-medium">{row.title}</span>
          {row.body && <span className="block max-w-[380px] truncate text-xs text-text-faint">{row.body}</span>}
        </span>
      ),
    },
    { key: 'channel', label: '渠道', render: (row) => <span className="pill bg-ink/[0.06] text-text-secondary">{row.channel}</span> },
    { key: 'kind', label: '类型', render: (row) => <span className="font-mono text-xs">{row.kind}</span> },
    { key: 'recipient', label: '接收用户', render: (row) => <span className="font-mono text-xs text-text-faint">{shortId(row.recipientUserId, 12)}</span> },
    { key: 'readAt', label: '已读', render: (row) => <span className="text-xs text-text-faint">{row.readAt ? formatDateTime(row.readAt) : '未读'}</span> },
    { key: 'createdAt', label: '创建时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.createdAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="通知管理"
          subtitle="全站通知流水（跨用户最近 100 条）+ 向指定用户发送通知"
          actions={<RefreshButton loading={list.loading} onClick={list.reload} />}
        />

        {notice && <div className="animate-pop rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{notice}</div>}

        <Panel title="发送通知" subtitle="接收用户 ID 可在「用户管理」中查询" delay={40}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block xl:col-span-2">
              <span className="mb-1 block text-xs text-text-secondary">接收用户 ID（UUID）</span>
              <input
                value={form.recipientUserId}
                onChange={(event) => setForm((prev) => ({ ...prev, recipientUserId: event.target.value }))}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 font-mono text-[13px] shadow-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-text-secondary">渠道</span>
              <select
                value={form.channel}
                onChange={(event) => setForm((prev) => ({ ...prev, channel: event.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm"
              >
                {CHANNELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-text-secondary">类型（kind）</span>
              <input
                value={form.kind}
                onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm"
              />
            </label>
            <label className="block xl:col-span-2">
              <span className="mb-1 block text-xs text-text-secondary">标题</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm"
              />
            </label>
            <label className="block xl:col-span-2">
              <span className="mb-1 block text-xs text-text-secondary">内容（可选）</span>
              <input
                value={form.body}
                onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={sending}
              onClick={() => void send()}
              className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {sending ? '发送中…' : '发送通知'}
            </button>
          </div>
        </Panel>

        <Panel title={`通知流水（${list.data?.length ?? 0}）`} delay={90} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={list.data ?? null} loading={list.loading} error={list.error} onReload={list.reload} emptyHint="暂无通知记录" />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
