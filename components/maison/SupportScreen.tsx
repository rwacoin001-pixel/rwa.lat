'use client'

import { AlertTriangle, BadgePercent, Check, ChevronRight, Headphones, Info, Plus, RotateCw, ScrollText, Send, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import {
  addSupportTicketMessage, closeSupportTicket, createSupportTicket, getSupportTicketTimeline, listSupportTickets,
  type SupportTicket, type TicketCategory, type TicketStatus,
} from '@/lib/support-data'
import { accountCopy } from '@/lib/maison-account-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer, Segmented, StatStrip, useAutoAnimate } from './motion'
import { fmtDateTime } from './format'
import { settle } from './settle'

type Filter = 'all' | 'active' | 'waiting' | 'closed'
const FILTERS: Filter[] = ['all', 'active', 'waiting', 'closed']
const inFilter: Record<Filter, (status: TicketStatus) => boolean> = {
  all: () => true,
  active: (status) => status === 'open' || status === 'pending' || status === 'investigating',
  waiting: (status) => status === 'waiting_user',
  closed: (status) => status === 'resolved' || status === 'closed',
}
const CATEGORIES: TicketCategory[] = ['support', 'dispute', 'appeal', 'scam_report']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BODY_MIN = 10
const BODY_MAX = 5000
const SUBJECT_MAX = 200

export const statusTone = (status: TicketStatus) =>
  status === 'waiting_user' ? 'warn' : status === 'resolved' ? 'up' : status === 'closed' ? 'pending' : 'live'
const stageOf = (status: TicketStatus) => status === 'open' || status === 'pending' ? 0 : status === 'resolved' ? 2 : status === 'closed' ? 3 : 1
const ticketPath = (id: string) => `/profile/support/ticket/${encodeURIComponent(id)}`

const setQuery = (name: string, value: string | null) => {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const { locale } = useI18n()
  const t = accountCopy[locale].support
  return <button type="button" className={s.row} onClick={() => openPath(ticketPath(ticket.id))} style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}>
    <span className={s.led} data-tone={statusTone(ticket.status)} aria-hidden="true" />
    <span className={s.rowMain}>
      <b className={s.clamp2} dir="auto">{ticket.subject}</b>
      <small><span className={s.mono}>{ticket.reference}</span> · {t.categories[ticket.category]}</small>
    </span>
    <span className={s.rowFig}>
      <span className={s.badge} data-tone={statusTone(ticket.status) === 'pending' ? undefined : statusTone(ticket.status)}>{t.statuses[ticket.status]}</span>
      <small className={s.muted}>{fmtDateTime(ticket.updatedAt, locale, { dateStyle: 'medium' })}</small>
    </span>
  </button>
}

/** `/profile/support` — the user's tickets with status filters, plus faster routes for common issues. */
export function SupportCenterScreen({ query = '' }: { query?: string }) {
  const { locale } = useI18n()
  const t = accountCopy[locale].support
  const common = marketCopy[locale].common
  const initial = queryParam(query, 'filter') as Filter | null
  const [filter, setFilter] = useState<Filter>(initial && FILTERS.includes(initial) ? initial : 'all')
  const tickets = useQuery('support:tickets', () => settle(listSupportTickets), { staleTime: 15_000 })
  const [listRef] = useAutoAnimate<HTMLUListElement>()
  const all = useMemo(() => [...(tickets.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [tickets.data])
  const shown = all.filter((ticket) => inFilter[filter](ticket.status))
  const count = (key: Filter) => all.filter((ticket) => inFilter[key](ticket.status)).length
  const choose = (value: Filter) => { setFilter(value); setQuery('filter', value === 'all' ? null : value) }
  const routes = [
    { key: 'scam', path: '/trust/report-scam', Icon: ShieldAlert },
    { key: 'channels', path: '/trust/official-channels', Icon: ShieldCheck },
    { key: 'fees', path: '/fees-and-limits', Icon: BadgePercent },
    { key: 'trust', path: '/trust', Icon: ScrollText },
  ] as const

  return <MaisonPage page="support" cta topbar={<RwaTopbar screen="support" title={t.title} onBack={() => backOr('/profile')} />}>
    <header className={s.hero}>
      <p className={s.kicker}><Headphones size={12} /> {t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>

    {tickets.error && !tickets.data ? <StateBlock tone="error" title={common.errorGeneric} body={tickets.error.message} retry={tickets.refetch} retryLabel={common.retry} />
      : !tickets.data ? <Skeleton rows={4} />
      : <>
        <Lacquer>
          <StatStrip items={[
            { label: t.tickets, value: all.length },
            { label: t.active, value: count('active') },
            { label: t.waiting, value: count('waiting'), tone: count('waiting') ? 'down' : undefined },
            { label: t.done, value: count('closed'), tone: count('closed') ? 'up' : undefined },
          ]} />
        </Lacquer>
        {all.length === 0 ? <StateBlock title={t.empty} body={t.emptyBody} /> : <>
          <Segmented value={filter} onChange={choose} label={t.status} sticky role="group"
            options={FILTERS.map((value) => ({ value, label: <>{t.filters[value]}<span className={s.segCount}>{count(value)}</span></> }))} />
          {shown.length === 0 ? <StateBlock title={t.emptyFilter} />
            : <ul className={s.list} ref={listRef}>{shown.map((ticket) => <li key={ticket.id}><TicketRow ticket={ticket} /></li>)}</ul>}
        </>}
      </>}

    <SectionHead index="→" title={t.routes} note={t.routesNote} />
    <div className={s.toolGrid}>{routes.map(({ key, path, Icon }) => <button key={key} type="button" onClick={() => openPath(path)}>
      <Icon size={17} strokeWidth={1.7} /><span>{t.routeItems[key]}</span>
    </button>)}</div>
    <p className={s.foot}><ShieldCheck size={12} /><span>{t.safety}</span></p>

    <div className={s.stickyCta}>
      <button type="button" className={s.cta} onClick={() => openPath('/profile/support/new')}><span>{t.newTicket}</span><span className={s.ctaIcon}><Plus size={17} /></span></button>
    </div>
  </MaisonPage>
}

/** `/profile/support/new` — topic, subject, description, optional order; the reference comes back from the API. */
export function SupportNewScreen({ query = '' }: { query?: string }) {
  const { locale } = useI18n()
  const t = accountCopy[locale].compose
  const sup = accountCopy[locale].support
  const presetCategory = queryParam(query, 'category') as TicketCategory | null
  const presetOrder = queryParam(query, 'order') ?? ''
  const [category, setCategory] = useState<TicketCategory>(presetCategory && CATEGORIES.includes(presetCategory) ? presetCategory : presetOrder ? 'dispute' : 'support')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [order, setOrder] = useState(presetOrder)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [created, setCreated] = useState<SupportTicket | null>(null)

  const errors = {
    subject: !subject.trim() ? t.errSubject : null,
    body: body.trim().length < BODY_MIN ? fill(t.errBody, { n: BODY_MIN }) : null,
    order: order.trim() && !UUID.test(order.trim()) ? t.errOrder : null,
  }
  const invalid = Boolean(errors.subject || errors.body || errors.order)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTried(true)
    if (invalid || busy) return
    setBusy(true)
    setFailure(null)
    // No idempotency key on this endpoint yet (see 接口需求-F1a); the busy guard only stops double taps.
    const result = await settle(() => createSupportTicket({ subject: subject.trim(), body: body.trim(), category, order_id: order.trim() || undefined }))
    setBusy(false)
    if (!result.ok) { setFailure(result.error.status === 401 ? t.session : `${t.failed} ${result.error.message}`); return }
    invalidate('support:')
    setCreated(result.data)
  }

  if (created) return <MaisonPage page="support-new" topbar={<RwaTopbar screen="support-new" title={t.kicker} onBack={() => openPath('/profile/support', { replace: true })} />}>
    <Lacquer aria-live="polite">
      <span className={s.statusMark} data-tone="up"><Check size={22} /></span>
      <h1 className={s.titleL} style={{ margin: 0 }}>{t.created}</h1>
      <p className={s.muted} style={{ margin: '6px 0 12px', fontSize: 13, lineHeight: 1.5 }}>{t.createdBody}</p>
      <dl className={s.summary}>
        <div data-strong="true"><dt>{t.reference}</dt><dd className={s.mono}>{created.reference}</dd></div>
        <div><dt>{t.topic}</dt><dd>{sup.categories[created.category]}</dd></div>
        <div><dt>{t.subject}</dt><dd dir="auto">{created.subject}</dd></div>
        <div><dt>{sup.status}</dt><dd><span className={s.badge} data-tone="live">{sup.statuses[created.status]}</span></dd></div>
      </dl>
    </Lacquer>
    <div className={s.ctaPair}>
      <button type="button" className={s.ghost} onClick={() => openPath('/profile/support', { replace: true })}>{t.allTickets}</button>
      <button type="button" className={s.cta} onClick={() => openPath(ticketPath(created.id), { replace: true })}><span>{t.openTicket}</span><span className={s.ctaIcon}><ChevronRight size={17} /></span></button>
    </div>
  </MaisonPage>

  return <MaisonPage page="support-new" cta topbar={<RwaTopbar screen="support-new" title={t.kicker} onBack={() => backOr('/profile/support')} />}>
    <header className={s.hero}>
      <p className={s.kicker}>{t.kicker}</p>
      <h1 className={s.display}>{t.title}</h1>
      <p className={s.lede}>{t.lede}</p>
    </header>

    <form onSubmit={(event) => void submit(event)} noValidate>
      <SectionHead index="01" title={t.topic} />
      <div className={s.pickList} role="radiogroup" aria-label={t.topic}>
        {CATEGORIES.map((value) => <button key={value} type="button" role="radio" className={s.pick} aria-checked={category === value} onClick={() => setCategory(value)}>
          <i aria-hidden="true" />
          <span><b>{sup.categories[value]}</b><small>{sup.categoryNotes[value]}</small></span>
        </button>)}
      </div>
      {category === 'scam_report' && <div className={s.notice} data-tone="info"><Info size={16} /><span>
        <button type="button" className={s.link} onClick={() => openPath('/trust/report-scam')}>{sup.routeItems.scam}<ChevronRight size={14} /></button>
      </span></div>}

      <SectionHead index="02" title={t.details} />
      <div className={s.actions}>
        <label className={s.field}>
          <span>{t.subject}</span>
          <input data-kind="text" dir="auto" value={subject} maxLength={SUBJECT_MAX} placeholder={t.subjectPh} onChange={(event) => setSubject(event.target.value)}
            aria-invalid={tried && Boolean(errors.subject)} aria-describedby="support-subject-meta" />
          <span className={s.fieldMeta} id="support-subject-meta">
            {tried && errors.subject ? <em className={s.fieldError}>{errors.subject}</em> : <em />}
            <span className={s.num}>{subject.length}/{SUBJECT_MAX}</span>
          </span>
        </label>
        <label className={s.field}>
          <span>{t.body}</span>
          <textarea dir="auto" rows={6} value={body} maxLength={BODY_MAX} placeholder={t.bodyPh} onChange={(event) => setBody(event.target.value)}
            aria-invalid={tried && Boolean(errors.body)} aria-describedby="support-body-meta" />
          <span className={s.fieldMeta} id="support-body-meta">
            {tried && errors.body ? <em className={s.fieldError}>{errors.body}</em> : <em>{t.safety}</em>}
            <span className={s.num}>{body.length}/{BODY_MAX}</span>
          </span>
        </label>
        <label className={s.field}>
          <span>{t.order} <small className={s.muted}>· {t.optional}</small></span>
          <input value={order} placeholder={t.orderPh} spellCheck={false} autoCapitalize="off" onChange={(event) => setOrder(event.target.value)}
            aria-invalid={tried && Boolean(errors.order)} aria-describedby="support-order-meta" />
          <span className={s.fieldMeta} id="support-order-meta">
            {tried && errors.order ? <em className={s.fieldError}>{errors.order}</em> : <em>{t.orderHint}</em>}
          </span>
        </label>
      </div>

      {failure && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{failure}</span></div>}

      <div className={s.stickyCta}>
        <button type="submit" className={s.cta} disabled={busy} aria-busy={busy}>
          <span>{busy ? t.submitting : t.submit}</span><span className={s.ctaIcon}>{busy ? <RotateCw size={17} /> : <Send size={17} />}</span>
        </button>
      </div>
    </form>
  </MaisonPage>
}

type ThreadItem =
  | { kind: 'message'; id: string; at: string; actor: 'user' | 'admin' | 'service'; body: string }
  | { kind: 'event'; id: string; at: string; text: string }

/** `/profile/support/ticket/:id` — status rail, the conversation, reply and a confirmed close. The id survives refresh via the path. */
export function SupportTicketScreen({ id }: { id: string | null }) {
  const { locale } = useI18n()
  const t = accountCopy[locale].ticket
  const sup = accountCopy[locale].support
  const common = marketCopy[locale].common
  const valid = Boolean(id && UUID.test(id))
  const timeline = useQuery(valid ? `support:ticket:${id}` : null, () => settle(() => getSupportTicketTimeline(id as string)), { staleTime: 10_000 })
  const [reply, setReply] = useState('')
  const [replyTried, setReplyTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [threadRef] = useAutoAnimate<HTMLOListElement>()

  const statusName = (value: unknown) => typeof value === 'string' && value in sup.statuses ? sup.statuses[value as TicketStatus] : String(value ?? '—')
  const thread = useMemo<ThreadItem[]>(() => {
    const data = timeline.data
    if (!data) return []
    const messages: ThreadItem[] = data.messages.map((m) => ({ kind: 'message', id: m.id, at: m.createdAt, actor: m.actorType, body: m.body }))
    // message_added duplicates the message itself; the ticket body is already the first user message.
    const events: ThreadItem[] = data.events.filter((e) => e.eventType !== 'message_added').map((e) => ({
      kind: 'event', id: e.id, at: e.createdAt,
      text: e.eventType === 'created' ? t.events.created
        : e.eventType === 'status_changed' ? fill(t.events.status, { from: statusName(e.previousStatus), to: statusName(e.nextStatus) })
        : e.eventType === 'assigned' ? t.events.assigned : t.events.updated,
    }))
    return [...messages, ...events].sort((a, b) => a.at.localeCompare(b.at) || (a.kind === 'event' ? -1 : 1))
  }, [timeline.data, locale])

  const topbar = <RwaTopbar screen="support-ticket" title={t.title} onBack={() => backOr('/profile/support')} />
  const notFound = !valid || (timeline.error && (timeline.error.status === 404 || timeline.error.status === 400))
  if (notFound) return <MaisonPage page="support-ticket" topbar={topbar}>
    <StateBlock title={t.notFound} body={t.notFoundBody} action={<button type="button" className={s.ghost} onClick={() => openPath('/profile/support', { replace: true })}>{t.back}</button>} />
  </MaisonPage>
  if (timeline.error && !timeline.data) return <MaisonPage page="support-ticket" topbar={topbar}>
    <StateBlock tone="error" title={common.errorGeneric} body={timeline.error.message} retry={timeline.refetch} retryLabel={common.retry} />
  </MaisonPage>
  if (!timeline.data) return <MaisonPage page="support-ticket" topbar={topbar}><Skeleton rows={5} /></MaisonPage>

  const ticket = timeline.data.ticket
  const closed = ticket.status === 'closed'
  const stage = stageOf(ticket.status)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    setReplyTried(true)
    if (!reply.trim() || sending) return
    setSending(true)
    setReplyError(null)
    const result = await settle(() => addSupportTicketMessage(ticket.id, reply.trim()))
    setSending(false)
    if (!result.ok) {
      if (result.error.status === 409) timeline.refetch()
      setReplyError(`${t.replyFailed} ${result.error.message}`)
      return
    }
    setReply('')
    setReplyTried(false)
    timeline.refetch()
    invalidate('support:tickets')
  }

  const close = async () => {
    if (closing) return
    setClosing(true)
    setCloseError(null)
    const result = await settle(() => closeSupportTicket(ticket.id))
    setClosing(false)
    if (!result.ok) { setCloseError(`${t.closeFailed} ${result.error.message}`); return }
    setConfirming(false)
    timeline.refetch()
    invalidate('support:tickets')
  }

  return <MaisonPage page="support-ticket" cta={!closed} topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}><span className={s.mono}>{ticket.reference}</span> · {sup.categories[ticket.category]}</p>
      <h1 className={s.titleL} dir="auto">{ticket.subject}</h1>
      <p className={s.foot} style={{ marginTop: 6 }}><span>{fill(t.opened, { t: fmtDateTime(ticket.createdAt, locale) })}</span><span>{fill(t.updated, { t: fmtDateTime(ticket.updatedAt, locale) })}</span></p>
    </header>

    <Lacquer aria-live="polite">
      <div className={s.railHead}>
        <span className={s.badge} data-tone={statusTone(ticket.status) === 'pending' ? undefined : statusTone(ticket.status)}>{sup.statuses[ticket.status]}</span>
      </div>
      <ol className={s.rail} style={{ ['--p' as string]: stage / 3 }} aria-label={sup.status}>
        {t.stages.map((label, index) => <li key={label} data-state={index < stage ? 'done' : index === stage ? 'now' : 'next'} aria-current={index === stage ? 'step' : undefined}>
          <i aria-hidden="true" /><span>{label}</span>
        </li>)}
      </ol>
      {ticket.status === 'waiting_user' && <div className={s.notice} data-tone="info"><Info size={16} /><span><b>{t.waitingYou}</b> · {t.waitingBody}</span></div>}
    </Lacquer>

    <SectionHead index="01" title={t.thread} note={t.threadNote} />
    <ol className={s.thread} ref={threadRef}>{thread.map((item) => item.kind === 'event'
      ? <li key={item.id} className={s.threadEvent}><span>{item.text}</span><time dateTime={item.at}>{fmtDateTime(item.at, locale, { dateStyle: 'short', timeStyle: 'short' })}</time></li>
      : <li key={item.id} className={s.bubble} data-actor={item.actor === 'user' ? 'user' : 'team'}>
        <header><b>{item.actor === 'user' ? t.you : item.actor === 'admin' ? t.team : t.system}</b><time dateTime={item.at}>{fmtDateTime(item.at, locale, { dateStyle: 'short', timeStyle: 'short' })}</time></header>
        <p dir="auto">{item.body}</p>
      </li>)}</ol>

    {closed ? <>
      <div className={s.notice} data-tone="info" role="status"><Info size={16} /><span>{t.closedNote}</span></div>
      <div className={s.actions}><button type="button" className={s.ghost} onClick={() => openPath('/profile/support/new')}><Plus size={15} />{t.newTicket}</button></div>
    </> : <>
      <form onSubmit={(event) => void send(event)} noValidate className={s.actions} style={{ marginTop: 20 }}>
        <label className={s.field}>
          <span>{t.reply}</span>
          <textarea dir="auto" rows={3} value={reply} maxLength={BODY_MAX} placeholder={t.replyPh} onChange={(event) => setReply(event.target.value)}
            aria-invalid={replyTried && !reply.trim()} aria-describedby="support-reply-meta" />
          <span className={s.fieldMeta} id="support-reply-meta">
            {replyTried && !reply.trim() ? <em className={s.fieldError}>{t.errReply}</em> : <em>{accountCopy[locale].compose.safety}</em>}
            <span className={s.num}>{reply.length}/{BODY_MAX}</span>
          </span>
        </label>
        {replyError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{replyError}</span></div>}
        <div className={s.stickyCta}>
          <button type="submit" className={s.cta} disabled={sending} aria-busy={sending}>
            <span>{sending ? t.sending : t.send}</span><span className={s.ctaIcon}>{sending ? <RotateCw size={17} /> : <Send size={17} />}</span>
          </button>
        </div>
      </form>

      {confirming ? <section className={s.confirm} role="alertdialog" aria-labelledby="close-ticket-title" aria-describedby="close-ticket-body">
        <h2 id="close-ticket-title">{t.closeTitle}</h2>
        <p id="close-ticket-body">{t.closeBody}</p>
        {closeError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{closeError}</span></div>}
        <div className={s.ctaPair}>
          <button type="button" className={s.ghost} onClick={() => setConfirming(false)} disabled={closing} autoFocus>{t.keepOpen}</button>
          <button type="button" className={s.ghost} data-tone="down" onClick={() => void close()} disabled={closing} aria-busy={closing}>
            {closing ? <RotateCw size={15} className={s.spin} /> : null}{closing ? t.closing : t.confirmClose}
          </button>
        </div>
      </section>
        : <div className={s.actions} style={{ marginTop: 16 }}>
          <button type="button" className={s.link} style={{ justifySelf: 'center' }} onClick={() => setConfirming(true)}>{t.close}</button>
        </div>}
    </>}
  </MaisonPage>
}
