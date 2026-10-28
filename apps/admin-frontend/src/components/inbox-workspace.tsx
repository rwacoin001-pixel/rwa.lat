'use client'

import { useEffect, useRef, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable, FilterTabs, PageHeader, Panel, RefreshButton, formatDateTime, shortId, useApi, type Col } from '@/components/console/framework'
import { NoAccess, useAdminProfile } from '@/components/rbac-gate'
import { adminErrorMessage } from '@/lib/admin-errors'
import { mailDocument } from '@/lib/mail-document'

type Thread = { id: string; subject: string; counterpart: string; unread: boolean; archived: boolean; assignee: string | null; updatedAt: string }
type Message = { id: string; direction: 'in' | 'out'; from: string; to: string[]; cc: string[]; text: string; html: string; createdAt: string; deliveryState: string; spamVerdict: string | null; attachments: { id: string; filename: string; size: number; dropped: boolean }[] }
type Detail = { thread: Thread; messages: Message[]; offset: number; nextOffset: number | null }
const FILTERS = [{ value: 'all', label: '全部' }, { value: 'unread', label: '未读' }, { value: 'archived', label: '已归档' }]
const DELIVERY: Record<string, string> = { queued: '等待发送', retrying: '正在重试', sent: '已发送', failed: '发送失败' }
const button = 'rounded-lg bg-ink/5 px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-ink/10 disabled:opacity-50'

function MessageBody({ message }: { message: Message }) {
  const [images, setImages] = useState(false)
  const [plain, setPlain] = useState(false)
  return <div className="space-y-2">
    {message.html ? <div className="flex gap-2"><button type="button" className={button} onClick={() => setPlain(!plain)}>{plain ? '查看邮件格式' : '查看纯文本'}</button>{!plain && !images && <button type="button" className={button} onClick={() => setImages(true)}>加载图片</button>}</div> : null}
    {message.html && !plain ? <iframe title={`邮件内容 ${message.id}`} sandbox="" referrerPolicy="no-referrer" srcDoc={mailDocument(message.html, images)} className="h-80 w-full rounded-xl bg-white" /> : <p className="whitespace-pre-wrap break-words">{message.text || '（无正文）'}</p>}
  </div>
}

export function InboxWorkspace() {
  const access = useAdminProfile()
  const canRead = access.status === 'ready' && !!access.profile?.permissions.includes('mail.read')
  const canReply = canRead && !!access.profile?.permissions.includes('mail.reply')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [messageOffset, setMessageOffset] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [replyAll, setReplyAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  // Retain the key after an ambiguous network failure, so retry cannot send a duplicate.
  const intent = useRef<{ fingerprint: string; key: string } | null>(null)
  const [notice, setNotice] = useState('')
  const queryString = new URLSearchParams({ filter, search: query, offset: String(offset) })
  const threads = useApi<Thread[]>(canRead ? `/api/admin/mail?${queryString}` : null)
  const timeline = useApi<Detail>(canRead && openId ? `/api/admin/mail/${openId}?offset=${messageOffset}` : null)
  const detail = timeline.data?.thread.id === openId && timeline.data.offset === messageOffset ? timeline.data : null
  useEffect(() => {
    if (!canRead || !openId) return
    const timer = window.setInterval(timeline.reload, 15000)
    return () => window.clearInterval(timer)
  }, [canRead, openId, timeline.reload])

  const refresh = () => { threads.reload(); timeline.reload(); window.dispatchEvent(new Event('mail-inbox-updated')) }
  const open = (id: string) => {
    if (busyRef.current || openId === id) return
    setOpenId(id); setMessageOffset(0); setText(''); setReplyAll(false); intent.current = null; setNotice('')
  }
  const mutate = async (action: 'reply' | 'state', body: Record<string, unknown>) => {
    if (busyRef.current || !openId) return
    busyRef.current = true; setBusy(true); setNotice('')
    try {
      const response = await fetch(`/api/admin/mail/${openId}/${action}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(35000) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(adminErrorMessage(result, response.status))
      if (action === 'reply') { setText(''); intent.current = null; setMessageOffset(0) }
      setNotice(action === 'reply' ? '回复已加入发送队列' : '邮件状态已更新')
      refresh()
    } catch (error) { setNotice(error instanceof Error ? error.message : '操作失败，请重试') }
    finally { busyRef.current = false; setBusy(false) }
  }
  const send = () => {
    if (!canReply || !text.trim()) return
    const fingerprint = JSON.stringify([openId, text, replyAll])
    if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, key: crypto.randomUUID() }
    void mutate('reply', { text, replyAll, requestKey: intent.current.key })
  }
  const columns: Col<Thread>[] = [{ key: 'subject', label: '邮件会话', render: row => <button type="button" disabled={busy} onClick={() => open(row.id)} aria-pressed={openId === row.id} className="w-full text-left"><span className={`block break-words hover:text-mint ${row.unread ? 'font-bold' : 'font-medium'}`}>{row.subject || '（无主题）'}</span><span className="block break-all text-xs text-text-faint">{row.counterpart}</span><span className="block text-xs text-text-faint">{formatDateTime(row.updatedAt)}</span></button> }]

  return <AdminLayout><div className="space-y-5">
    <PageHeader title="收件箱" subtitle="support@a-reit.com 的客户邮件" actions={<RefreshButton loading={threads.loading} onClick={refresh} />} />
    {access.status === 'loading' ? <p className="text-sm text-text-faint">加载中…</p> : !canRead ? <NoAccess permissions={['mail.read']} /> : <>
      {notice && <div role="status" className="animate-pop rounded-xl bg-ink/5 px-4 py-3 text-sm">{notice}</div>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
        <Panel title="邮件" delay={40}>
          <div className="space-y-3">
            <FilterTabs options={FILTERS} value={filter} onChange={value => { setFilter(value); setOffset(0) }} />
            <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setQuery(search); setOffset(0) }}><input aria-label="搜索邮件" placeholder="搜索主题、邮箱或正文" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm shadow-sm" /><button className={button}>搜索</button></form>
            <DataTable columns={columns} rows={threads.data ?? null} loading={threads.loading} error={threads.error} onReload={threads.reload} emptyHint="暂无邮件" />
            <div className="flex justify-between"><button type="button" className={button} disabled={!offset || threads.loading} onClick={() => setOffset(Math.max(0, offset - 50))}>上一页</button><button type="button" className={button} disabled={threads.loading || (threads.data?.length ?? 0) < 50} onClick={() => setOffset(offset + 50)}>下一页</button></div>
          </div>
        </Panel>
        <Panel title={detail?.thread.subject || '邮件详情'} subtitle={detail?.thread.counterpart} delay={90}>
          {!openId && <p className="py-6 text-center text-sm text-text-faint">选择一封邮件查看内容</p>}
          {timeline.loading && <p className="py-6 text-center text-sm text-text-faint">加载中…</p>}
          {timeline.error && <p role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{timeline.error}</p>}
          {detail && <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={busy} className={button} onClick={() => void mutate('state', { archived: !detail.thread.archived })}>{detail.thread.archived ? '移回收件箱' : '归档'}</button><button type="button" disabled={busy} className={button} onClick={() => void mutate('state', { unread: !detail.thread.unread })}>{detail.thread.unread ? '标为已读' : '标为未读'}</button><button type="button" disabled={busy} className={button} onClick={() => void mutate('state', { assign: detail.thread.assignee === access.profile?.id ? 'none' : 'me' })}>{detail.thread.assignee === access.profile?.id ? '取消分配' : '分配给我'}</button><span className="text-xs text-text-faint">处理人：{detail.thread.assignee ? detail.thread.assignee === access.profile?.id ? '我' : shortId(detail.thread.assignee) : '未分配'}</span></div>
            <div className="flex gap-2">{messageOffset > 0 && <button type="button" className={button} onClick={() => setMessageOffset(0)}>最新邮件</button>}{detail.nextOffset !== null && <button type="button" className={button} onClick={() => setMessageOffset(detail.nextOffset!)}>更早邮件</button>}</div>
            <div className="max-h-[65vh] space-y-2.5 overflow-y-auto rounded-2xl bg-ink/[0.03] p-4">
              {detail.messages.map(message => <article key={message.id} className={message.direction === 'out' ? 'ml-4 space-y-2 rounded-2xl rounded-br-md bg-mint/12 px-4 py-2.5 text-sm' : 'mr-4 space-y-2 rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-ink/[0.04]'}>
                <p className="break-all text-[11px] font-medium text-text-faint">{message.from} · {formatDateTime(message.createdAt)}{message.direction === 'out' ? ` · ${DELIVERY[message.deliveryState] ?? message.deliveryState}` : ''}</p>
                <p className="break-all text-xs text-text-faint">收件人：{message.to.join('、')}{message.cc.length ? ` · 抄送：${message.cc.join('、')}` : ''}</p>
                {message.direction === 'in' && message.spamVerdict && <p className="text-xs text-text-faint">邮件筛查：{message.spamVerdict}</p>}
                <MessageBody message={message} />
                {message.attachments.length > 0 && <ul className="space-y-1 border-t border-ink/10 pt-2">{message.attachments.map(a => <li key={a.id} className="break-all text-xs">{a.dropped ? <span className="text-text-faint">{a.filename} · 超过 5 MB，未保存</span> : <a href={`/api/admin/mail/attachments/${a.id}`} download className="text-mint underline">{a.filename} · {Math.ceil(a.size / 1024)} KB</a>}</li>)}</ul>}
              </article>)}
            </div>
            {canReply && <div className="space-y-2.5"><textarea aria-label="回复内容" disabled={busy} maxLength={20000} rows={4} value={text} onChange={event => setText(event.target.value)} placeholder="输入回复内容（将发送邮件）…" className="w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm shadow-sm" /><div className="flex items-center justify-between gap-2"><select aria-label="回复方式" disabled={busy} value={replyAll ? 'all' : 'reply'} onChange={event => setReplyAll(event.target.value === 'all')} className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"><option value="reply">回复</option><option value="all">回复全部</option></select><button type="button" disabled={busy || !text.trim()} onClick={send} className="rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill disabled:opacity-50">{busy ? '处理中…' : '发送回复'}</button></div></div>}
          </div>}
        </Panel>
      </div>
    </>}
  </div></AdminLayout>
}
