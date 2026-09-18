'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'

type Ticket = {
  id: string
  authorUserId: string
  subject: string
  body: string
  status: string
  priority: string
  category: string
  reference: string
  assignee?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
}

type TicketMessage = { id: string; actorType: string; body: string; createdAt: string }
type Timeline = { ticket: Ticket; messages: TicketMessage[]; events: Array<Record<string, unknown>> }

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'open', label: '待处理' },
  { value: 'pending', label: '挂起' },
  { value: 'investigating', label: '调查中' },
  { value: 'waiting_user', label: '等待用户' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
]

const RESPOND_STATUS = [
  { value: 'waiting_user', label: '回复并等待用户（waiting_user）' },
  { value: 'investigating', label: '标记调查中（investigating）' },
  { value: 'pending', label: '挂起（pending）' },
  { value: 'resolved', label: '标记已解决（resolved）' },
  { value: 'closed', label: '关闭工单（closed）' },
]

export default function SupportPage() {
  const [status, setStatus] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyStatus, setReplyStatus] = useState('waiting_user')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const tickets = useApi<Ticket[]>(`/api/admin/support/tickets${status ? `?status=${status}` : ''}`)
  const timeline = useApi<Timeline>(openId ? `/api/admin/support/tickets/${openId}/timeline` : null)

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 6000)
  }

  const open = (ticket: Ticket) => {
    setOpenId(ticket.id)
    setReplyBody('')
    setReplyStatus('waiting_user')
  }

  const respond = async () => {
    if (!openId || !replyBody.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/support/tickets/${openId}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: replyBody.trim(), status: replyStatus }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `回复失败 (HTTP ${res.status})`)
      showNotice('回复已发送，工单状态已更新')
      setReplyBody('')
      timeline.reload()
      tickets.reload()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : '回复失败')
    } finally {
      setBusy(false)
    }
  }

  const columns: Col<Ticket>[] = [
    {
      key: 'subject',
      label: '标题',
      render: (row) => (
        <button type="button" onClick={() => open(row)} className="text-left">
          <span className="block font-medium hover:text-mint">{row.subject}</span>
          <span className="block text-xs text-text-faint">
            {row.category} · 用户 {shortId(row.authorUserId)} · {row.reference}
          </span>
        </button>
      ),
    },
    { key: 'priority', label: '优先级', render: (row) => <span className="text-xs">{row.priority}</span> },
    { key: 'status', label: '状态', render: (row) => <StatusPill value={row.status} /> },
    { key: 'assignee', label: '处理人', render: (row) => <span className="text-xs text-text-faint">{row.assignee ? shortId(row.assignee) : '—'}</span> },
    { key: 'updatedAt', label: '最近更新', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.updatedAt)}</span> },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (row) => (
        <button type="button" onClick={() => open(row)} className="rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 hover:bg-sky-500/20">
          查看 / 回复
        </button>
      ),
    },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="客服工单"
          subtitle="用户咨询、投诉与技术支持工单；回复将同步到用户的工单时间线"
          actions={<RefreshButton loading={tickets.loading} onClick={tickets.reload} />}
        />

        {notice && <div className="animate-pop rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{notice}</div>}

        <Panel title={`工单（${tickets.data?.length ?? 0}）`} actions={<FilterTabs options={STATUS_TABS} value={status} onChange={setStatus} />} delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={tickets.data ?? null} loading={tickets.loading} error={tickets.error} onReload={tickets.reload} emptyHint="暂无工单" />
          </div>
        </Panel>

        {openId && (
          <Panel
            title={`工单详情 — ${timeline.data?.ticket.subject ?? shortId(openId)}`}
            subtitle={timeline.data ? `${timeline.data.ticket.category} · ${timeline.data.ticket.reference} · 提交于 ${formatDateTime(timeline.data.ticket.createdAt)}` : ''}
            actions={
              <>
                {timeline.data && <StatusPill value={timeline.data.ticket.status} />}
                <button type="button" onClick={() => setOpenId(null)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-ink/[0.05]">
                  收起
                </button>
              </>
            }
            delay={90}
          >
            {timeline.loading && <p className="py-6 text-center text-sm text-text-faint">加载中…</p>}
            {timeline.error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{timeline.error}</p>}
            {timeline.data && (
              <div className="space-y-4">
                <div className="max-h-96 space-y-2.5 overflow-y-auto rounded-2xl bg-ink/[0.03] p-4">
                  {timeline.data.messages.map((message) => (
                    <div
                      key={message.id}
                      className={
                        message.actorType === 'admin'
                          ? 'ml-8 rounded-2xl rounded-br-md bg-mint/12 px-4 py-2.5 text-sm'
                          : 'mr-8 rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-ink/[0.04]'
                      }
                    >
                      <p className="mb-1 text-[11px] font-medium text-text-faint">{message.actorType === 'admin' ? '客服（我方）' : '用户'} · {formatDateTime(message.createdAt)}</p>
                      <p className="whitespace-pre-wrap">{message.body}</p>
                    </div>
                  ))}
                  {!timeline.data.messages.length && <p className="text-center text-sm text-text-faint">暂无消息</p>}
                </div>
                {timeline.data.ticket.status !== 'closed' ? (
                  <div className="space-y-2.5">
                    <textarea
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      rows={3}
                      placeholder="输入回复内容（将发送给用户）…"
                      className="w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm shadow-sm"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        value={replyStatus}
                        onChange={(event) => setReplyStatus(event.target.value)}
                        className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm"
                      >
                        {RESPOND_STATUS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || !replyBody.trim()}
                        onClick={() => void respond()}
                        className="rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110 disabled:opacity-50"
                      >
                        {busy ? '发送中…' : '发送回复'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl bg-ink/[0.04] px-4 py-3 text-center text-sm text-text-faint">工单已关闭</p>
                )}
              </div>
            )}
          </Panel>
        )}
      </div>
    </AdminLayout>
  )
}
