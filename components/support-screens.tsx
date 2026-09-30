'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Headphones,
  MessageCircle,
  RotateCw,
  Search,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { RwaScreen } from '@/lib/rwa-routes'
import RwaTopbar from './rwa-topbar'
import { TiltedSurface } from './motion-effects'
import { EmptyState } from './ui/Empty'
import {
  addSupportTicketMessage,
  closeSupportTicket,
  createSupportTicket,
  getSupportTicketTimeline,
  listSupportTickets,
  TICKET_STATUS_TONE,
  type SupportTicket,
  type TicketCategory,
  type TicketEvent,
  type TicketMessage,
  type TicketStatus,
  type TicketTimeline,
} from '@/lib/support-data'

type SupportScreenProps = {
  go: (screen: RwaScreen) => void
}

type SupportFaq = {
  question: string
  answer: string
  keywords: string
  Icon: LucideIcon
}

const SUPPORT_FAQ: SupportFaq[] = [
  {
    question: '充值后多久可以到账？',
    answer: '链上确认完成后，余额会进入账本。到账时间取决于网络拥堵和所需确认数，可在充值详情中查看进度。',
    keywords: '充值 USDT 网络 到账 确认 交易哈希',
    Icon: WalletCards,
  },
  {
    question: '支持哪些充值网络？',
    answer: '请以钱包充值页展示的网络为准。发送前务必核对币种、网络和地址，错网络转账可能无法找回。',
    keywords: '充值 网络 币种 地址 错网络',
    Icon: ShieldCheck,
  },
  {
    question: 'KYC 审核需要多久？',
    answer: '审核时长会因地区、材料完整度和人工复核而不同。若需要补充材料，页面会显示原因和下一步。',
    keywords: 'KYC 身份认证 审核 证件 补充材料',
    Icon: FileText,
  },
  {
    question: '提现为什么还没有到账？',
    answer: '提现可能处于安全审核、链上处理中或网络确认阶段。请在提现记录中查看状态、手续费、交易哈希和预计时间。',
    keywords: '提现 到账 审核 交易哈希 手续费',
    Icon: Clock3,
  },
  {
    question: '订单一直处于处理中怎么办？',
    answer: '订单状态由执行结果决定。请先查看订单时间线和产品交易窗口；状态长时间不变时，可以关联订单提交工单。',
    keywords: '订单 处理中 购买 赎回 交易窗口',
    Icon: MessageCircle,
  },
  {
    question: '费用、最低金额和赎回窗口在哪里看？',
    answer: '每个产品的详情页会列出最低金额、费用、锁定期、赎回窗口和结算周期，确认订单前也会再次展示。',
    keywords: '费用 最低金额 赎回 锁定期 流动性',
    Icon: FileText,
  },
  {
    question: '如何保护账户和提现地址？',
    answer: '请启用多重验证，确认设备和会话列表，并只使用账户内显示的地址。RWA.LAT 不会索要密码、验证码或私钥。',
    keywords: '安全 MFA 地址 白名单 验证码 私钥 防诈骗',
    Icon: ShieldCheck,
  },
  {
    question: '在哪里查看流水和交易凭证？',
    answer: '在钱包和活动记录中可以查看账本流水；订单详情会提供状态记录及可下载的交易凭证。',
    keywords: '流水 账本 凭证 订单 PDF CSV 活动记录',
    Icon: FileText,
  },
]

const SUPPORT_FAQ_EN: SupportFaq[] = [
  { question: 'How long does a deposit take?', answer: 'After the required chain confirmations, the balance is recorded in the ledger. Timing depends on network congestion and can be checked in the deposit details.', keywords: 'deposit USDT network arrival confirmation transaction hash', Icon: WalletCards },
  { question: 'Which deposit networks are supported?', answer: 'Use the networks shown on the deposit screen. Confirm the asset, network and address before sending; an incorrect network may be unrecoverable.', keywords: 'deposit network asset address wrong network', Icon: ShieldCheck },
  { question: 'How long does KYC review take?', answer: 'Review time depends on region, document completeness and manual checks. If more information is needed, the next step will be shown in the account.', keywords: 'KYC identity review documents additional information', Icon: FileText },
  { question: 'Why has my withdrawal not arrived?', answer: 'A withdrawal may be in security review, chain processing or network confirmation. Check the withdrawal record for status, fees, transaction hash and timing.', keywords: 'withdrawal arrival review transaction hash fee', Icon: Clock3 },
  { question: 'What should I do if an order is still processing?', answer: 'Order status follows the execution result. Review the order timeline and product trading window; if it remains unchanged, open a support case with the order attached.', keywords: 'order processing buy redeem trading window', Icon: MessageCircle },
  { question: 'Where can I see fees, minimums and exit windows?', answer: 'Each product detail page lists minimums, fees, lockups, exit windows and settlement cycles. The order review shows them again before confirmation.', keywords: 'fees minimum exit lockup liquidity', Icon: FileText },
  { question: 'How do I protect my account and withdrawal addresses?', answer: 'Enable multi-factor protection, review device sessions and use only addresses shown in your account. RWA.LAT never asks for passwords, codes or private keys.', keywords: 'security MFA address whitelist code private key fraud', Icon: ShieldCheck },
  { question: 'Where can I view ledger activity and receipts?', answer: 'Wallet and activity pages show ledger movements. Order details include status history and downloadable transaction receipts.', keywords: 'ledger receipt order PDF CSV activity', Icon: FileText },
]

type SupportCopy = {
  eyebrow: string; title: string; body: string; newTicket: string; search: string; faq: string; answers: string; noMatch: string; noMatchBody: string; submit: string
  tickets: string; ticketRecords: string; guestTitle: string; guestBody: string; signIn: string; noTickets: string; noTicketsBody: string
  newEyebrow: string; newTitle: string; newBody: string; createdEyebrow: string; createdTitle: string; reference: string; createdBody: string; viewTickets: string
  subject: string; category: string; details: string; orderId: string; required: string; optional: string; subjectPlaceholder: string; detailsPlaceholder: string; orderPlaceholder: string; submitting: string; submitTicket: string
  ticketDetail: string; noTicket: string; noTicketBody: string; backToTickets: string; noTimeline: string; reply: string; replyPlaceholder: string; sendReply: string; closing: string; closeTicket: string; closedNote: string; loading: string; retry: string
}

const SUPPORT_COPY: Record<'en' | 'zh-CN', SupportCopy> = {
  en: {
    eyebrow: 'SUPPORT CENTER', title: 'Help center', body: 'Start with self-service answers, then contact support when you need a tracked case.', newTicket: 'New ticket', search: 'Search deposits, KYC, withdrawals or orders…', faq: 'Common questions', answers: '{count} answers', noMatch: 'No matching answers', noMatchBody: 'Try another keyword or submit a support ticket.', submit: 'Submit ticket', tickets: 'My tickets', ticketRecords: 'Service records', guestTitle: 'Sign in to view tickets', guestBody: 'Tickets, replies and progress are saved securely to your account.', signIn: 'Sign in', noTickets: 'No tickets yet', noTicketsBody: 'Create a tracked support record when you need help with a deposit, KYC, order or account.', newEyebrow: 'CONTACT SUPPORT', newTitle: 'Bring the issue to support', newBody: 'Include an order number or transaction hash to help us locate the issue faster.', createdEyebrow: 'CASE CREATED', createdTitle: 'Ticket created', reference: 'Reference', createdBody: 'Support will reply in the ticket. You can check progress at any time.', viewTickets: 'View tickets', subject: 'Subject', category: 'Category', details: 'Details', orderId: 'Related order ID', required: 'Required', optional: 'Optional', subjectPlaceholder: 'For example: deposit confirmed but balance not updated', detailsPlaceholder: 'Describe what happened, when it happened and how we can help. Do not include passwords, codes or private keys.', orderPlaceholder: 'For example: ord_…', submitting: 'Submitting…', submitTicket: 'Submit ticket', ticketDetail: 'Ticket details', noTicket: 'No ticket selected', noTicketBody: 'Return to the help center to view your ticket list.', backToTickets: 'Back to tickets', noTimeline: 'No timeline entries yet', reply: 'Reply to support', replyPlaceholder: 'Add more information…', sendReply: 'Send reply', closing: 'Closing…', closeTicket: 'Issue resolved — close ticket', closedNote: 'This ticket is closed. Create a new ticket if you need more help.', loading: 'Loading', retry: 'Retry',
  },
  'zh-CN': {
    eyebrow: '支持中心', title: '帮助中心', body: '先从自助答案开始，需要时再联系支持团队。', newTicket: '新建工单', search: '搜索充值、KYC、提现、订单…', faq: '常见问题', answers: '{count} 个答案', noMatch: '没有找到匹配答案', noMatchBody: '可以换一个关键词，或直接提交工单。', submit: '提交工单', tickets: '我的工单', ticketRecords: '服务记录', guestTitle: '登录后查看工单', guestBody: '工单、回复和处理进度会安全保存在你的账户中。', signIn: '登录', noTickets: '还没有工单', noTicketsBody: '遇到充值、KYC、订单或账户问题时，可以在这里留下可追踪的服务记录。', newEyebrow: '联系支持团队', newTitle: '把问题交给支持团队', newBody: '提供订单号或交易哈希，有助于我们更快定位问题。', createdEyebrow: '工单已创建', createdTitle: '工单已创建', reference: '参考编号', createdBody: '支持团队会在工单中回复，你可以随时查看处理进度。', viewTickets: '查看工单', subject: '主题', category: '分类', details: '详情', orderId: '关联订单号', required: '必填', optional: '选填', subjectPlaceholder: '例如：充值已确认但余额未更新', detailsPlaceholder: '请描述发生了什么、何时发生，以及你希望我们如何协助。不要填写密码、验证码或私钥。', orderPlaceholder: '例如：ord_…', submitting: '提交中…', submitTicket: '提交工单', ticketDetail: '工单详情', noTicket: '没有指定工单', noTicketBody: '返回帮助中心查看你的工单列表。', backToTickets: '返回工单列表', noTimeline: '暂时没有时间线记录', reply: '回复支持团队', replyPlaceholder: '补充信息…', sendReply: '发送回复', closing: '关闭中…', closeTicket: '问题已解决，关闭工单', closedNote: '该工单已关闭，如需继续协助请新建工单。', loading: '正在加载', retry: '重试',
  },
}

function supportCopy(locale: string) { return SUPPORT_COPY[locale === 'zh-CN' ? 'zh-CN' : 'en'] }
function interpolateSupport(value: string, count: number) { return value.replace('{count}', String(count)) }

const SUPPORT_STATUS_LABELS: Record<'en' | 'zh-CN', Record<TicketStatus, string>> = {
  en: { open: 'Submitted', pending: 'In progress', investigating: 'Investigating', waiting_user: 'Waiting for you', resolved: 'Resolved', closed: 'Closed' },
  'zh-CN': { open: '已提交', pending: '处理中', investigating: '调查中', waiting_user: '待您补充', resolved: '已解决', closed: '已关闭' },
}
const SUPPORT_CATEGORY_LABELS: Record<'en' | 'zh-CN', Record<TicketCategory, string>> = {
  en: { support: 'Account & use', dispute: 'Order dispute', appeal: 'Appeal & review', scam_report: 'Fraud report' },
  'zh-CN': { support: '使用与账户', dispute: '订单争议', appeal: '申诉与复核', scam_report: '诈骗举报' },
}

const TICKET_CATEGORIES: TicketCategory[] = ['support', 'dispute', 'appeal', 'scam_report']

function useTimeAgo() {
  const { locale } = useI18n()

  return (iso?: string | null) => {
    if (!iso) return ''
    const timestamp = new Date(iso).getTime()
    if (!Number.isFinite(timestamp)) return ''
    const diffMs = Math.max(0, Date.now() - timestamp)
    const zh = locale.startsWith('zh')
    const minutes = Math.floor(diffMs / 60_000)
    if (minutes < 1) return zh ? '刚刚' : 'just now'
    if (minutes < 60) return zh ? `${minutes} 分钟前` : `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return zh ? `${hours} 小时前` : `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return zh ? `${days} 天前` : `${days}d ago`
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso))
  }
}

function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) return locale === 'zh-CN' ? '时间未知' : 'Time unavailable'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return locale === 'zh-CN' ? '时间未知' : 'Time unavailable'
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function requestError(error: unknown, locale = 'en'): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return locale === 'zh-CN' ? '暂时无法加载，请稍后重试。' : 'Unable to load this right now. Try again shortly.'
}

function statusLabel(status: string | undefined, locale: string): string {
  if (!status) return locale === 'zh-CN' ? '未知状态' : 'Unknown status'
  const labels = SUPPORT_STATUS_LABELS[locale === 'zh-CN' ? 'zh-CN' : 'en']
  return labels[status as TicketStatus] ?? status
}

function TicketStatusBadge({ status, locale }: { status: TicketStatus; locale: string }) {
  const tone = TICKET_STATUS_TONE[status]
  return <span className={`support-badge is-${tone}`}>{statusLabel(status, locale)}</span>
}

function SupportError({ message, onRetry, locale }: { message: string; onRetry: () => void; locale: string }) {
  const copy = supportCopy(locale)
  return (
    <div className="support-empty support-empty--error" role="alert">
      <AlertTriangle size={23} />
      <b>{locale === 'zh-CN' ? '暂时无法加载' : 'Unable to load this right now'}</b>
      <span>{message}</span>
      <button type="button" className="support-more" onClick={onRetry}><RotateCw size={14} /> {copy.retry}</button>
    </div>
  )
}

function SupportSkeleton({ kind = 'list', locale = 'en' }: { kind?: 'list' | 'ticket'; locale?: string }) {
  const copy = supportCopy(locale)
  if (kind === 'ticket') {
    return (
      <div className="support-ticket-skeleton" aria-label={copy.loading}>
        <div className="support-skel support-skel--title" />
        <div className="support-skel support-skel--message" />
        <div className="support-skel support-skel--message support-skel--short" />
      </div>
    )
  }
  return (
    <div className="support-ticket-list" aria-label={copy.loading}>
      <div className="support-skel support-skel--row" />
      <div className="support-skel support-skel--row" />
      <div className="support-skel support-skel--row" />
    </div>
  )
}

function TicketCard({ ticket, timeAgo, openTicket, locale }: { ticket: SupportTicket; timeAgo: (iso?: string | null) => string; openTicket: (id: string) => void; locale: string }) {
  return (
    <TiltedSurface className="support-ticket-card-motion" maxTilt={2.5}>
    <button type="button" className="support-ticket-card" onClick={() => openTicket(ticket.id)}>
      <span className="support-ticket-card__icon" aria-hidden="true"><MessageCircle size={18} /></span>
      <span className="support-ticket-card__body">
        <span className="support-ticket-card__topline">
          <b>{ticket.subject}</b>
          <TicketStatusBadge status={ticket.status} locale={locale} />
        </span>
        <small>{ticket.reference}{ticket.orderId ? ` · 订单 ${ticket.orderId}` : ''}</small>
        <small>{timeAgo(ticket.updatedAt) || formatDateTime(ticket.updatedAt, locale)}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
    </TiltedSurface>
  )
}

export function SupportCenterScreen({ go, openTicket, isGuest = false }: { go: (screen: RwaScreen) => void; openTicket: (id: string) => void; isGuest?: boolean }) {
  const { locale } = useI18n()
  const copy = supportCopy(locale)
  const timeAgo = useTimeAgo()
  const [query, setQuery] = useState('')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(!isGuest)
  const [failed, setFailed] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadTickets = useCallback(async () => {
    if (isGuest) {
      setTickets([])
      setFailed(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    setErrorMessage('')
    try {
      setTickets(await listSupportTickets())
    } catch (error) {
      setFailed(true)
      setErrorMessage(requestError(error, locale))
    } finally {
      setLoading(false)
    }
  }, [isGuest, locale])

  useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  const faqItems = locale === 'zh-CN' ? SUPPORT_FAQ : SUPPORT_FAQ_EN
  const filteredFaq = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return faqItems
    return faqItems.filter((item) => `${item.question} ${item.answer} ${item.keywords}`.toLocaleLowerCase().includes(normalized))
  }, [faqItems, query])

  return (
    <section className="screen support-center-screen">
      <RwaTopbar screen="support" title={copy.title} onBack={() => go('profile')} />
      <header className="support-center-header">
        <div>
          <p className="support-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <small>{copy.body}</small>
        </div>
        <button type="button" className="support-primary" onClick={() => go('support-new')}><Headphones size={17} /> {copy.newTicket}</button>
      </header>

      <label className="support-search" htmlFor="support-faq-search">
        <Search size={18} aria-hidden="true" />
        <input id="support-faq-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
      </label>

      <section className="support-faq-section" aria-labelledby="support-faq-title">
        <div className="support-section-heading">
          <span><FileText size={17} /> {copy.faq}</span>
          <small>{interpolateSupport(copy.answers, filteredFaq.length)}</small>
        </div>
        {filteredFaq.length === 0 ? (
          <EmptyState variant="inline" icon={Search} title={copy.noMatch} body={copy.noMatchBody} action={<button type="button" className="support-more" onClick={() => go('support-new')}>{copy.submit} <ArrowRight size={14} /></button>} />
        ) : (
          <div className="support-faq-list" id="support-faq-title">
            {filteredFaq.map(({ question, answer, Icon }) => (
              <details className="support-faq-item" key={question}>
                <summary><span className="support-faq-item__icon"><Icon size={17} /></span><b>{question}</b><ChevronRight size={17} /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="support-tickets-section" aria-labelledby="support-tickets-title">
        <div className="support-section-heading">
          <span><MessageCircle size={17} /> {copy.tickets}</span>
          <small id="support-tickets-title">{copy.ticketRecords}</small>
        </div>
        {isGuest ? (
          <div className="support-login-card">
            <span className="support-login-card__icon"><Headphones size={20} /></span>
            <span><b>{copy.guestTitle}</b><small>{copy.guestBody}</small></span>
            <button type="button" onClick={() => go('login')}>{copy.signIn} <ArrowRight size={14} /></button>
          </div>
        ) : loading ? (
          <SupportSkeleton locale={locale} />
        ) : failed ? (
          <SupportError message={errorMessage} locale={locale} onRetry={() => void loadTickets()} />
        ) : tickets.length === 0 ? (
          <EmptyState variant="card" icon={MessageCircle} title={copy.noTickets} body={copy.noTicketsBody} action={<button type="button" className="support-more" onClick={() => go('support-new')}>{copy.newTicket} <ArrowRight size={14} /></button>} />
        ) : (
          <div className="support-ticket-list">
            {tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} timeAgo={timeAgo} openTicket={openTicket} locale={locale} />)}
          </div>
        )}
      </section>
    </section>
  )
}

export function SupportNewScreen({ go, isGuest = false }: { go: (screen: RwaScreen) => void; isGuest?: boolean }) {
  const { locale } = useI18n()
  const copy = supportCopy(locale)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('support')
  const [body, setBody] = useState('')
  const [orderId, setOrderId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [createdTicket, setCreatedTicket] = useState<SupportTicket | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isGuest || submitting || !subject.trim() || !body.trim()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const ticket = await createSupportTicket({
        subject: subject.trim(),
        body: body.trim(),
        category,
        order_id: orderId.trim() || undefined,
      })
      setCreatedTicket(ticket)
    } catch (error) {
      setSubmitError(requestError(error, locale))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="screen support-new-screen">
      <RwaTopbar screen="support-new" title={copy.newTicket} onBack={() => go('support')} />

      {createdTicket ? (
        <div className="support-success glass" role="status">
          <CheckCircle2 size={32} />
          <p className="support-eyebrow">{copy.createdEyebrow}</p>
          <h1>{copy.createdTitle}</h1>
          <span>{copy.reference}</span>
          <strong>{createdTicket.reference}</strong>
          <small>{copy.createdBody}</small>
          <button type="button" className="support-primary" onClick={() => go('support')}>{copy.viewTickets} <ArrowRight size={16} /></button>
        </div>
      ) : (
        <>
          <div className="support-form-intro">
            <p className="support-eyebrow">{copy.newEyebrow}</p>
            <h1>{copy.newTitle}</h1>
            <small>{copy.newBody}</small>
          </div>
          {isGuest && (
            <div className="support-login-card support-login-card--form">
              <span className="support-login-card__icon"><ShieldCheck size={20} /></span>
              <span><b>{copy.guestTitle}</b><small>{copy.guestBody}</small></span>
              <button type="button" onClick={() => go('login')}>{copy.signIn} <ArrowRight size={14} /></button>
            </div>
          )}
          <form className="support-form" onSubmit={submit}>
            <fieldset disabled={isGuest || submitting}>
              <label>
                <span>{copy.subject} <i>{copy.required}</i></span>
                <input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={copy.subjectPlaceholder} required maxLength={120} />
              </label>
              <label>
                <span>{copy.category} <i>{copy.required}</i></span>
                <select name="category" value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)} required>
                  {TICKET_CATEGORIES.map((entry) => <option key={entry} value={entry}>{SUPPORT_CATEGORY_LABELS[locale === 'zh-CN' ? 'zh-CN' : 'en'][entry]}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.details} <i>{copy.required}</i></span>
                <textarea name="body" value={body} onChange={(event) => setBody(event.target.value)} placeholder={copy.detailsPlaceholder} rows={7} required maxLength={4000} />
              </label>
              <label>
                <span>{copy.orderId} <small>{copy.optional}</small></span>
                <input name="order_id" value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder={copy.orderPlaceholder} maxLength={120} />
              </label>
            </fieldset>
            {submitError ? <div className="support-form-error" role="alert"><AlertTriangle size={16} />{submitError}</div> : null}
            <button className="support-primary support-submit" type="submit" disabled={isGuest || submitting || !subject.trim() || !body.trim()}>
              {submitting ? copy.submitting : copy.submitTicket} {!submitting && <ArrowRight size={17} />}
            </button>
          </form>
        </>
      )}
    </section>
  )
}

type TimelineEntry =
  | { kind: 'message'; at: string; message: TicketMessage }
  | { kind: 'event'; at: string; event: TicketEvent }

function eventText(event: TicketEvent, locale: string): string {
  if (event.previousStatus || event.nextStatus) {
    return locale === 'zh-CN'
      ? `状态：${statusLabel(event.previousStatus, locale)} → ${statusLabel(event.nextStatus, locale)}`
      : `Status: ${statusLabel(event.previousStatus, locale)} → ${statusLabel(event.nextStatus, locale)}`
  }
  if (event.eventType === 'created') return locale === 'zh-CN' ? '工单已创建' : 'Ticket created'
  if (event.eventType === 'closed') return locale === 'zh-CN' ? '工单已关闭' : 'Ticket closed'
  if (event.eventType === 'reopened') return locale === 'zh-CN' ? '工单已重新打开' : 'Ticket reopened'
  return locale === 'zh-CN' ? `状态更新：${event.eventType}` : `Status update: ${event.eventType}`
}

function actorLabel(actorType: TicketMessage['actorType'], locale: string): string {
  if (actorType === 'user') return locale === 'zh-CN' ? '你' : 'You'
  if (actorType === 'service') return locale === 'zh-CN' ? '服务' : 'Service'
  return locale === 'zh-CN' ? '支持团队' : 'Support team'
}

export function SupportTicketScreen({ ticketId, go }: { ticketId: string | null; go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const copy = supportCopy(locale)
  const [timeline, setTimeline] = useState<TicketTimeline | null>(null)
  const [loading, setLoading] = useState(Boolean(ticketId))
  const [failed, setFailed] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    if (!ticketId) {
      setTimeline(null)
      setFailed(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    setErrorMessage('')
    try {
      setTimeline(await getSupportTicketTimeline(ticketId))
    } catch (error) {
      setFailed(true)
      setErrorMessage(requestError(error, locale))
    } finally {
      setLoading(false)
    }
  }, [locale, ticketId])

  useEffect(() => {
    void load()
  }, [load])

  const entries = useMemo<TimelineEntry[]>(() => {
    if (!timeline) return []
    return [
      ...timeline.messages.map((message) => ({ kind: 'message' as const, at: message.createdAt, message })),
      ...timeline.events.map((event) => ({ kind: 'event' as const, at: event.createdAt, event })),
    ].sort((left, right) => {
      const delta = new Date(left.at).getTime() - new Date(right.at).getTime()
      if (Number.isFinite(delta) && delta !== 0) return delta
      return left.kind === 'event' ? -1 : 1
    })
  }, [timeline])

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = reply.trim()
    if (!ticketId || !body || sending || timeline?.ticket.status === 'closed') return
    setSending(true)
    setActionError('')
    try {
      await addSupportTicketMessage(ticketId, body)
      setReply('')
      await load()
    } catch (error) {
      setActionError(requestError(error, locale))
    } finally {
      setSending(false)
    }
  }

  const closeTicket = async () => {
    if (!ticketId || closing || timeline?.ticket.status === 'closed') return
    setClosing(true)
    setActionError('')
    try {
      await closeSupportTicket(ticketId)
      await load()
    } catch (error) {
      setActionError(requestError(error, locale))
    } finally {
      setClosing(false)
    }
  }

  return (
    <section className="screen support-ticket-screen">
      <RwaTopbar screen="support-ticket" title={copy.ticketDetail} onBack={() => go('support')} />
      {!ticketId ? (
        <EmptyState variant="card" icon={MessageCircle} title={copy.noTicket} body={copy.noTicketBody} action={<button type="button" className="support-more" onClick={() => go('support')}>{copy.backToTickets} <ArrowRight size={14} /></button>} />
      ) : failed ? (
        <SupportError message={errorMessage} locale={locale} onRetry={() => void load()} />
      ) : loading || !timeline ? (
        <SupportSkeleton kind="ticket" locale={locale} />
      ) : (
        <>
          <header className="support-ticket-header glass">
            <div className="support-ticket-header__meta">
              <span className="support-eyebrow">{timeline.ticket.reference}</span>
              <TicketStatusBadge status={timeline.ticket.status} locale={locale} />
            </div>
            <h1>{timeline.ticket.subject}</h1>
            <small>{locale === 'zh-CN' ? '创建于' : 'Created'} {formatDateTime(timeline.ticket.createdAt, locale)} · {SUPPORT_CATEGORY_LABELS[locale === 'zh-CN' ? 'zh-CN' : 'en'][timeline.ticket.category]}</small>
          </header>

          <div className="support-timeline" aria-live="polite">
            {entries.length === 0 ? <EmptyState variant="inline" icon={Clock3} title={copy.noTimeline} /> : null}
            {entries.map((entry) => entry.kind === 'event' ? (
              <div className="support-timeline-event" key={`event-${entry.event.id}`}><Clock3 size={14} /><span>{eventText(entry.event, locale)}</span><time>{formatDateTime(entry.event.createdAt, locale)}</time></div>
            ) : (
              <article className={`support-message is-${entry.message.actorType}`} key={`message-${entry.message.id}`}>
                <div className="support-message__bubble">
                  <span className="support-message__actor">{actorLabel(entry.message.actorType, locale)}</span>
                  <p>{entry.message.body}</p>
                  <time>{formatDateTime(entry.message.createdAt, locale)}</time>
                </div>
              </article>
            ))}
          </div>

          {actionError ? <div className="support-form-error" role="alert"><AlertTriangle size={16} />{actionError}</div> : null}
          {timeline.ticket.status !== 'closed' ? (
            <>
              <form className="support-reply-form" onSubmit={sendReply}>
                <label htmlFor="support-ticket-reply">{copy.reply}</label>
                <div className="support-reply-form__row">
                  <textarea id="support-ticket-reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder={copy.replyPlaceholder} rows={3} maxLength={4000} disabled={sending} />
                  <button type="submit" className="support-send" aria-label={copy.sendReply} disabled={!reply.trim() || sending}><ArrowRight size={19} /></button>
                </div>
              </form>
              <button type="button" className="support-close-ticket" onClick={() => void closeTicket()} disabled={closing}>
                {closing ? copy.closing : copy.closeTicket}
              </button>
            </>
          ) : (
            <div className="support-closed-note"><CheckCircle2 size={17} /> {copy.closedNote}</div>
          )}
        </>
      )}
    </section>
  )
}
