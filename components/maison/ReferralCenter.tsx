'use client'
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, BookOpen, Check, ChevronRight, CircleHelp, Copy, Delete, Gift, ImagePlus, Share2, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { getSessionToken, SESSION_CHANGED } from '@/lib/api/_http'
import { referralMe, referralSummary, referralInvitees, referralAwards, changeReferralCode, claimReferralRewards, referralFunnel } from '@/lib/api/referral'
import { backOr, openPath } from '@/lib/maison-nav'
import { MaisonPage, StateBlock, Skeleton } from './primitives'
import { fmtAtomic, fmtDate } from './format'
import { ReferralRules } from './ReferralRules'
import { ReferralTeamRewards } from './ReferralTeamRewards'
import { ReferralSheet, useHostTheme } from './ReferralSheet'
import { InvitePlate, type PlateStat } from './InvitePlate'
import { CodeSlots } from './CodeSlots'
import { MemberSheet } from './ReferralMemberSheet'
import type { ReferralMember } from '@/lib/api/referral'
import { displayInviteCode } from '@/lib/referral-invite'
import { porcelainAvatar } from '@/components/community-avatar'
import { nativeCan, nativeShare } from '@/lib/native-app'
import x from './referral.module.css'
import c from './referral-card.module.css'
import v from './invite-centre.module.css'
import k from './invite-keypad.module.css'

type SheetKind = 'rules' | 'qr' | 'edit' | 'poster' | 'rewards' | 'team' | 'awards' | null
type Translate = (cn: string, en: string) => string

const PAGE_SIZE = 20
const CODE_PATTERN = /^[A-Za-z0-9]{6}$/
const ReferralPosterComposer = dynamic(() => import('./ReferralPosterComposer').then(module => module.ReferralPosterComposer), { ssr: false })
const lengthClass = (code: string) => code.length <= 8 ? 's' : code.length <= 12 ? 'm' : 'l'

/** One rate per level, side by side; never summed into a single figure. */
function CodeForm({ code, busy, error, onSave, onDraftChange, t }: { code: string; busy: boolean; error: string; onSave: (code: string) => void; onDraftChange: () => void; t: Translate }) {
  const id = useId(), [draft, setDraft] = useState(''), [local, setLocal] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!CODE_PATTERN.test(draft)) { setLocal(t('请输入 6 位', 'Enter 6 characters')); return }
    if (draft.toLowerCase() === code.toLowerCase()) { setLocal(t('与当前邀请码相同', 'Same as the current code')); return }
    setLocal('')
    onSave(draft.toLowerCase())
  }
  const message = local || error
  const press = (key: string) => {
    if (busy) return
    navigator.vibrate?.(6)
    setDraft(value => key === 'del' ? value.slice(0, -1) : value.length >= 6 ? value : value + key)
    setLocal(''); onDraftChange()
  }
  // Our own keypad (2026-10-29): the brand letters down the left — A·R·E·I·T — and the digits, so a code is always the
  // brand plus numbers and the system keyboard never covers the sheet. A hardware keyboard still types.
  const typed = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toUpperCase()
    if (KEYPAD_KEYS.includes(key)) { event.preventDefault(); press(key) }
    else if (event.key === 'Backspace') { event.preventDefault(); press('del') }
  }
  return <form className={x.editForm} onSubmit={submit} noValidate>
    <label id={`${id}-label`}>{t('新邀请码', 'New invitation code')}</label>
    <div className={k.display} role="textbox" aria-readonly="true" aria-labelledby={`${id}-label`} aria-invalid={message ? true : undefined} aria-describedby={`${id}-hint ${id}-error`} tabIndex={0} onKeyDown={typed} data-autofocus>
      <CodeSlots value={draft} length={6} invalid={Boolean(message)} active={!busy} />
    </div>
    <p id={`${id}-error`} className={x.formError} role="alert">{message}</p>
    <div className={k.pad} role="group" aria-label={t('邀请码键盘', 'Code keypad')}>
      {KEYPAD.map(key => <button key={key} type="button" className={k.key} data-kind={key === 'del' ? 'del' : /\d/.test(key) ? 'digit' : 'letter'} disabled={busy || (key === 'del' ? !draft : draft.length >= 6)} aria-label={key === 'del' ? t('删除', 'Delete') : key} onClick={() => press(key)}>
        {key === 'del' ? <Delete size={22} strokeWidth={1.8} aria-hidden="true" /> : key}
      </button>)}
    </div>
    <p id={`${id}-hint`} className={x.hint}>{t(`当前 ${code.toUpperCase()} · 6 位，每 30 天可修改一次；旧链接仍可使用。`, `Now ${code.toUpperCase()} · 6 characters. Change once every 30 days; previous links remain valid.`)}</p>
    <button type="submit" className={x.primary} disabled={busy} aria-busy={busy}>{busy ? t('保存中', 'Saving') : t('保存邀请码', 'Save code')}</button>
  </form>
}

const KEYPAD = ['A', '1', '2', '3', 'R', '4', '5', '6', 'E', '7', '8', '9', 'I', 'T', '0', 'del']
const KEYPAD_KEYS = KEYPAD.filter(key => key !== 'del')

/** The invite centre. `embedded`: the Community tab's 邀请 view (2026-10-28), no page shell or top bar of its own. */
export function ReferralScreen({ query = '', embedded = false }: { query?: string; embedded?: boolean }) {
  // /profile/referral now opens the Community tab's 邀请 view (a tick later: the shell re-adds its path listener after this effect).
  useEffect(() => {
    if (embedded) return
    const timer = window.setTimeout(() => openPath('/community?tab=invite', { replace: true }), 0)
    return () => window.clearTimeout(timer)
  }, [embedded])
  const { locale } = useI18n(), zh = locale.startsWith('zh')
  const t: Translate = (cn, en) => zh ? cn : en
  const [level, setLevel] = useState('all'), [page, setPage] = useState(1)
  const [sheet, setSheet] = useState<SheetKind>(null), [member, setMember] = useState<ReferralMember | null>(null)
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState('')
  const [saving, setSaving] = useState(false), [editError, setEditError] = useState('')
  const [claiming, setClaiming] = useState(false), [claimNote, setClaimNote] = useState(''), [claimError, setClaimError] = useState('')
  const [claimDone, setClaimDone] = useState(false)
  const claimKey = useRef<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null), copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const theme = useHostTheme(rootRef)
  // A referral notice links here with ?member=<label> (2026-10-29): open that member's sheet.
  useEffect(() => {
    const label = new URLSearchParams(query || (typeof window === 'undefined' ? '' : window.location.search)).get('member')
    if (label && /^[A-Za-z0-9_-]{4,64}$/.test(label)) setMember({ memberLabel: label, level: 0, boundAt: '' })
  }, [query])
  const balanceId = useId()
  const me = useQuery('referral:v2:me', referralMe, { staleTime: 30_000 })
  const summary = useQuery('referral:v2:summary', referralSummary, { staleTime: 30_000 })
  const funnel = useQuery('referral:v2:funnel', referralFunnel, { staleTime: 60_000 })
  const members = useQuery(sheet === 'team' ? `referral:v2:members:${page}:${level}` : null, () => referralInvitees(page, level), { staleTime: 30_000 })
  const awards = useQuery(sheet === 'awards' || sheet === 'rewards' ? `referral:v2:awards:${page}` : null, () => referralAwards(page), { staleTime: 30_000 })
  const editGen = useRef(0), mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; clearTimeout(copyTimer.current) }
  }, [])
  useEffect(() => {
    // A replaced account must not inherit the previous account's in-flight edit.
    const onSession = () => { editGen.current += 1; setSaving(false); setEditError(''); setSheet(sheet => sheet === 'edit' || sheet === 'poster' ? null : sheet) }
    window.addEventListener(SESSION_CHANGED, onSession)
    return () => window.removeEventListener(SESSION_CHANGED, onSession)
  }, [])

  const code = me.data?.code
  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/r/${code.toUpperCase()}` : ''
  const sum = summary.data
  const unit = sum?.currency || 'USDT'
  const money = (atomic?: string) => fmtAtomic(atomic, sum?.decimals ?? 6, '', 2).trim()
  const pct = (bps: number) => `${Number((bps / 100).toFixed(2))}%`
  const levelCount = (value: number) => sum ? String(sum.levels.find(row => row.level === value)?.count ?? 0) : '—'
  const totalCount = sum ? String(sum.levels.filter(row => row.level >= 1 && row.level <= 3).reduce((total, row) => total + row.count, 0)) : '—'
  const states: Record<string, string> = { earned: t('可领取', 'Claimable'), claimed: t('已领取', 'Claimed') }
  const kinds: Record<string, string> = { purchase: t('买入返佣', 'Purchase rebate'), fee: t('手续费返佣', 'Fee rebate') }
  const claimable = sum ? BigInt(sum.balances.available) > BigInt(0) : false
  const list = sheet === 'awards' ? awards : members
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1
  // Each edit session gets a generation; a completion from an older one must not touch the current sheet.
  const bumpEdit = () => { editGen.current += 1; setSaving(false) }
  const closeSheet = () => { bumpEdit(); setSheet(null) }

  const flash = () => {
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => { setCopied(false); setCopyError('') }, 3000)
  }
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopyError(''); setCopied(true)
    } catch {
      setCopied(false); setCopyError(t('无法复制，请长按链接复制', 'Unable to copy. Select the link to copy.'))
    }
    flash()
  }
  const share = async () => {
    if (!link) return
    // The Android app's WebView has no Web Share: the app opens the system share sheet.
    if (nativeCan('share')) { const result = await nativeShare({ title: 'A-REIT', url: link }); if (!result.ok && result.reason === 'failed') await copy(); return }
    if (!navigator.share) return copy()
    try { await navigator.share({ title: 'A-REIT', url: link }) } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) await copy() }
  }
  const openEdit = () => { bumpEdit(); setEditError(''); setSheet('edit') }
  const save = async (next: string) => {
    if (saving) return
    const gen = editGen.current, token = getSessionToken()
    const current = () => mounted.current && gen === editGen.current && getSessionToken() === token
    setSaving(true); setEditError('')
    try {
      const result = await changeReferralCode(next)
      if (!result.ok) { if (current()) setEditError(result.error.message); return }
      // The change landed server-side; refresh only if the same account is still signed in.
      if (getSessionToken() !== token) return
      if (current()) setSheet(sheet => sheet === 'edit' ? null : sheet)
      if (mounted.current) setCopied(false)
      await invalidate('referral:v2:me')
    } catch {
      if (current()) setEditError(t('保存失败，请重试', 'Unable to save. Please try again.'))
    } finally { if (current()) setSaving(false) }
  }

  const claim = async () => {
    if (claiming || !claimable) return
    const token = getSessionToken()
    // One key per claim attempt: a retry after a lost response replays the same claim instead of a new one.
    claimKey.current ??= `referral-claim-${crypto.randomUUID()}`
    setClaiming(true); setClaimError(''); setClaimNote('')
    try {
      const result = await claimReferralRewards(claimKey.current)
      if (getSessionToken() !== token || !mounted.current) return
      if (!result.ok) {
        if (result.error.code === 'REFERRAL_NOTHING_TO_CLAIM') claimKey.current = null
        setClaimError(result.error.message)
        return
      }
      claimKey.current = null
      setClaimDone(true); window.setTimeout(() => { if (mounted.current) setClaimDone(false) }, 1600)
      setClaimNote(t(`已领取 ${money(result.data.amountAtomic)} ${unit} 到可用余额`, `${money(result.data.amountAtomic)} ${unit} added to your available balance`))
      await invalidate(['referral:v2:summary', 'referral:v2:awards', 'wallet:', 'portfolio:', 'home:'])
    } catch {
      if (mounted.current) setClaimError(t('领取失败，请重试', 'Unable to claim. Please try again.'))
    } finally { if (mounted.current) setClaiming(false) }
  }

  // The plate's figures (2026-10-29): people invited with the split by level, total earned, claimable, and the last 30 days.
  const plateStats: PlateStat[] = [
    { label: t('邀请人数', 'Invited'), value: totalCount, note: sum ? `${t('一级', 'L1')} ${levelCount(1)} · ${t('二级', 'L2')} ${levelCount(2)} · ${t('三级', 'L3')} ${levelCount(3)}` : undefined },
    { label: t('累计奖励', 'Total earned'), value: sum ? money(sum.balances.total) : '—', unit },
    { label: t('可领取', 'Claimable'), value: sum ? money(sum.balances.available) : '—', unit },
    { label: t('近 30 天注册', 'Sign-ups, 30 days'), value: funnel.data?.registered ? String(funnel.data.registered.last30d) : '—', note: funnel.data?.opened ? t(`打开 ${funnel.data.opened.last30d} · 首投 ${funnel.data.subscribed.last30d}`, `${funnel.data.opened.last30d} opens · ${funnel.data.subscribed.last30d} first buys`) : undefined },
  ]
  const copyLabel = copied ? t('已复制', 'Copied') : t('复制', 'Copy')
  const CopyIcon = copied ? Check : Copy
  const retryLabel = t('重试', 'Retry')

  return <div ref={rootRef} className={`${x.ref} ${x.screen} ${c.page}`}>
    <Shell embedded={embedded} topbar={<header className={`${x.topbar} ${c.topbarPlain}`}>
      <button type="button" className={x.iconBtn} aria-label={t('返回', 'Back')} onClick={() => backOr('/profile')}><ArrowLeft size={22} strokeWidth={1.75} /></button>
      <h1>{t('邀请好友', 'Invite friends')}</h1>
      <button type="button" className={x.iconBtn} aria-label={t('查看邀请规则', 'View invitation rules')} aria-haspopup="dialog" onClick={() => setSheet('rules')}><CircleHelp size={21} strokeWidth={1.75} /></button>
    </header>}>
      {/* Invite (2026-10-29, docs/design-system.md §7.7): the first screen is one metal invitation plate (name, code, QR),
          one ink share button, and the quiet actions as text under it. Rewards, rules and the team follow. */}
      {me.error
        ? <StateBlock tone="error" title={t('邀请码暂不可用', 'Invitation code unavailable')} body={me.error.message} retry={me.refetch} retryLabel={retryLabel} />
        : !code ? <div className={v.platePlaceholder} aria-busy="true" />
        : <InvitePlate code={code} link={link} stats={plateStats} copied={copied} onCopy={() => void copy()} onEdit={openEdit} onQr={() => setSheet('qr')} t={t} />}
      {/* One row under the card (2026-10-29): share in ink, then poster, rewards, team and rules — each opens its own
          sheet (or the poster composer). Copy and edit live on the card next to the link and the code. */}
      <nav className={v.actionRow} aria-label={t('邀请操作', 'Invitation actions')}>
        {([
          ['share', t('分享', 'Share'), Share2],
          ['poster', t('海报', 'Poster'), ImagePlus],
          ['rewards', t('奖励', 'Rewards'), Gift],
          ['team', t('团队', 'Team'), Users],
          ['rules', t('规则', 'Rules'), BookOpen],
        ] as const).map(([key, label, Icon]) => <button key={key} type="button" data-kind={key} aria-haspopup={key === 'share' ? undefined : 'dialog'}
          disabled={!code || (key === 'poster' && (!sum || !!summary.error || summary.loading || me.loading))}
          onClick={() => { if (key === 'share') void share(); else { setPage(1); setSheet(key) } }}>
          <i>{key === 'rewards' && claimable && <em aria-hidden="true" />}<Icon size={20} strokeWidth={1.8} aria-hidden="true" /></i>
          <span>{label}</span>
        </button>)}
      </nav>
      <p className={v.feedback} role="status" data-tone={copyError ? 'error' : undefined}>{copyError || (copied ? t('邀请链接已复制', 'Invitation link copied') : '')}</p>
    </Shell>

    {sheet === 'rewards' && <ReferralSheet tall title={t('奖励', 'Rewards')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      <section className={v.sheetCard} aria-labelledby={balanceId}>
        <h2 id={balanceId} className={v.cardHead}>{t('可领取奖励', 'Claimable rewards')}</h2>
        {summary.error
          ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={summary.error.message} retry={summary.refetch} retryLabel={retryLabel} />
          : !sum ? <Skeleton rows={2} /> : <>
            <p className={v.amount} dir="ltr"><span>{money(sum.balances.available)}</span><small>{unit}</small></p>
            <dl className={v.stats}>
              <div><dt>{t('已领取', 'Claimed')}</dt><dd>{money(sum.balances.claimed)}</dd></div>
              <div><dt>{t('累计奖励', 'Total earned')}</dt><dd>{money(sum.balances.total)}</dd></div>
              <div><dt>{t('邀请人数', 'Invited')}</dt><dd>{totalCount}</dd></div>
            </dl>
            {sum.payoutsEnabled && <div className={v.claimWrap}><button type="button" className={v.claim} data-state={claiming ? 'busy' : claimDone ? 'done' : undefined} disabled={(!claimable && !claimDone) || claiming} aria-busy={claiming} aria-label={claiming ? t('领取中', 'Claiming') : undefined} onClick={() => void claim()}>
              {claiming ? <i className={v.ring} aria-hidden="true" /> : claimDone ? <Check size={22} strokeWidth={2.4} aria-hidden="true" /> : t('领取到可用余额', 'Claim to available balance')}
            </button></div>}
            {claimNote ? <p className={v.receipt} role="status"><span>{claimNote}</span></p>
              : <p className={v.hint} role="status">{t('买入奖励和手续费返佣在这里领取；团队月结自动到账。', 'Purchase and fee rewards are claimed here; team settlement is credited automatically.')}</p>}
            {claimError && <p className={v.error} role="alert">{claimError}</p>}
          </>}
      </section>
      <h3 className={v.sheetHead}>{t('奖励记录', 'Reward records')}</h3>
      {awards.error ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={awards.error.message} retry={awards.refetch} retryLabel={retryLabel} />
        : !awards.data ? <Skeleton rows={3} />
        : !awards.data.items.length ? <p className={v.empty} role="status">{t('还没有奖励记录', 'No rewards yet')}</p>
        : <ul className={v.sheetRows}>{awards.data.items.map(row => <li key={row.id}>
          <img src={porcelainAvatar(row.memberLabel)} alt="" width={40} height={40} aria-hidden="true" />
          <div><b>{fmtAtomic(row.amountAtomic, row.decimals, row.currency)}</b><small>{kinds[row.kind] ?? row.kind} · {t(`第 ${row.level} 级`, `Level ${row.level}`)} · {fmtDate(row.occurredAt, locale)}</small></div>
          <span className={v.state} data-state={row.state}>{states[row.state] ?? row.state}</span>
        </li>)}</ul>}
    </ReferralSheet>}
    {(sheet === 'team' || sheet === 'awards') && <ReferralSheet tall title={sheet === 'team' ? t('我的团队', 'My team') : t('奖励记录', 'Reward records')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      {sheet === 'team' && <div className={v.chips} role="group" aria-label={t('团队层级', 'Team level')}>
        {([['all', t('全部', 'All'), totalCount], ['1', t('一级', 'Level 1'), levelCount(1)], ['2', t('二级', 'Level 2'), levelCount(2)], ['3', t('三级', 'Level 3'), levelCount(3)]] as const).map(([value, label, count]) =>
          <button key={value} type="button" aria-pressed={level === value} onClick={() => { setLevel(value); setPage(1) }}>{label}<b>{count}</b></button>)}
      </div>}
      {list.error
        ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={list.error.message} retry={list.refetch} retryLabel={retryLabel} />
        : !list.data ? <Skeleton rows={3} /> : <>
          {!list.data.items.length
            ? <p className={v.empty} role="status">{sheet === 'awards' ? t('还没有奖励记录', 'No rewards yet') : level === 'all' ? t('分享邀请，好友注册后会出现在这里。', 'Share your invite. Friends who sign up appear here.') : t('这一级还没有成员', 'No members at this level')}</p>
            : sheet === 'team'
              ? <ul className={v.sheetRows}>{members.data?.items.map((row, index) => <li key={`${row.memberLabel}:${index}`}>
                <button type="button" className={v.memberRow} aria-haspopup="dialog" onClick={() => setMember(row)}>
                  <img src={porcelainAvatar(row.memberLabel)} alt="" width={40} height={40} aria-hidden="true" />
                  <div><b dir="ltr">{t('用户', 'Member')} {row.memberLabel.slice(0, 6).toUpperCase()}</b><small>{t(`第 ${row.level} 级`, `Level ${row.level}`)}</small></div>
                  <time dateTime={row.boundAt}>{fmtDate(row.boundAt, locale)}</time>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>)}</ul>
              : <ul className={v.sheetRows}>{awards.data?.items.map(row => <li key={row.id}>
                <img src={porcelainAvatar(row.memberLabel)} alt="" width={40} height={40} aria-hidden="true" />
                <div><b>{fmtAtomic(row.amountAtomic, row.decimals, row.currency)}</b><small>{kinds[row.kind] ?? row.kind} · {t(`第 ${row.level} 级`, `Level ${row.level}`)} · {fmtDate(row.occurredAt, locale)}</small></div>
                <span className={v.state} data-state={row.state}>{states[row.state] ?? row.state}</span>
              </li>)}</ul>}
          {list.data.total > PAGE_SIZE && <nav className={v.pager} aria-label={t('分页', 'Pagination')}>
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('上一页', 'Previous')}</button>
            <span>{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{t('下一页', 'Next')}</button>
          </nav>}
        </>}
    </ReferralSheet>}
    {member && <MemberSheet member={member} theme={theme} inertRef={rootRef} locale={locale} t={t} onClose={() => setMember(null)} />}
    {sheet === 'rules' && <ReferralSheet tall title={t('邀请规则', 'Invitation rules')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      {sum
        ? <><ReferralRules rules={sum.rules} locale={locale} teamEnabled={sum.teamSettlementEnabled} /><ReferralTeamRewards locale={locale} tiers={sum.rules.teamTiers} /><p className={v.disclaimer}>{t('奖励比例按层级分别计算，不代表投资收益，也不构成收益承诺。', 'Rates apply per level separately. They are not investment returns and carry no promise of income.')}</p></>
        : summary.error
          ? <StateBlock tone="error" title={t('规则暂不可用', 'Rules unavailable')} body={summary.error.message} retry={summary.refetch} retryLabel={retryLabel} />
          : <Skeleton rows={3} />}
    </ReferralSheet>}
    {sheet === 'qr' && code && <ReferralSheet title={t('扫码邀请', 'Scan to join')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      <div className={x.qrSheet}>
        <div className={x.qrBig}><QRCodeSVG value={link} size={216} marginSize={2} level="M" bgColor="#ffffff" fgColor="#000000" title={t('邀请链接二维码', 'Invitation QR code')} /></div>
        <p className={x.code} data-len={lengthClass(code)} dir="ltr">{displayInviteCode(code)}</p>
        <p className={x.linkWrap}>{link}</p>
        <button type="button" className={x.primary} onClick={() => void copy()}><CopyIcon size={18} strokeWidth={1.75} aria-hidden="true" />{copyLabel}</button>
        <p className={x.feedback} role="status">{copied ? t('邀请链接已复制', 'Invitation link copied') : ''}</p>
        {copyError && <p className={x.error} role="alert">{copyError}</p>}
      </div>
    </ReferralSheet>}
    {sheet === 'edit' && code && <ReferralSheet title={t('修改邀请码', 'Edit invitation code')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      <CodeForm code={code} busy={saving} error={editError} onSave={next => void save(next)} onDraftChange={() => setEditError('')} t={t} />
    </ReferralSheet>}
    {sheet === 'poster' && code && sum && <ReferralPosterComposer key={code} code={code.toUpperCase()} summary={sum} locale={locale} theme={theme} inertRef={rootRef} onClose={closeSheet} sourceReady={!summary.loading && !me.loading && !summary.error && !me.error} />}
  </div>
}

function Shell({ embedded, topbar, children }: { embedded: boolean; topbar: ReactNode; children: ReactNode }) {
  return embedded ? <div className={c.embedded}>{children}</div> : <MaisonPage page="referral" topbar={topbar}>{children}</MaisonPage>
}
