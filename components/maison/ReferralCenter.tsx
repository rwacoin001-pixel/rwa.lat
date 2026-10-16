'use client'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, Check, CircleHelp, Copy, Pencil, Share2, ImagePlus, ArrowUpRight } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { getSessionToken, SESSION_CHANGED } from '@/lib/api/_http'
import { referralMe, referralSummary, referralInvitees, referralAwards, changeReferralCode, claimReferralRewards } from '@/lib/api/referral'
import { backOr } from '@/lib/maison-nav'
import { MaisonPage, StateBlock, Skeleton } from './primitives'
import { fmtAtomic, fmtDate } from './format'
import { ReferralRules } from './ReferralRules'
import { ReferralSheet, useHostTheme } from './ReferralSheet'
import { posterCopy } from '@/lib/referral-poster-copy'
import { nativeCan, nativeShare } from '@/lib/native-app'
import x from './referral.module.css'

type Tab = 'team' | 'rewards'
type SheetKind = 'rules' | 'qr' | 'edit' | 'poster' | null
type Translate = (cn: string, en: string) => string

const PAGE_SIZE = 20
const CODE_PATTERN = /^[A-Za-z0-9]{6,16}$/
const ReferralPosterComposer = dynamic(() => import('./ReferralPosterComposer').then(module => module.ReferralPosterComposer), { ssr: false })
const lengthClass = (code: string) => code.length <= 8 ? 's' : code.length <= 12 ? 'm' : 'l'

function CodeForm({ code, busy, error, onSave, onDraftChange, t }: { code: string; busy: boolean; error: string; onSave: (code: string) => void; onDraftChange: () => void; t: Translate }) {
  const id = useId(), [draft, setDraft] = useState(code), [local, setLocal] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!CODE_PATTERN.test(draft)) { setLocal(t('请输入 6–16 位字母或数字', 'Enter 6–16 letters or digits')); return }
    if (draft === code) { setLocal(t('与当前邀请码相同', 'Same as the current code')); return }
    setLocal('')
    onSave(draft)
  }
  const message = local || error
  return <form className={x.editForm} onSubmit={submit} noValidate>
    <label htmlFor={`${id}-input`}>{t('新邀请码', 'New invitation code')}</label>
    <div className={x.field}>
      <input id={`${id}-input`} data-autofocus value={draft} minLength={6} maxLength={16} pattern="[a-zA-Z0-9]{6,16}" required readOnly={busy}
        autoComplete="off" autoCapitalize="off" spellCheck={false} aria-invalid={message ? true : undefined} aria-describedby={`${id}-hint ${id}-error`}
        onChange={event => { setDraft(event.target.value.replace(/\s/g, '')); setLocal(''); onDraftChange() }} />
      <span className={x.count} aria-hidden="true">{draft.length}/16</span>
    </div>
    <p id={`${id}-error`} className={x.formError} role="alert">{message}</p>
    <p id={`${id}-hint`} className={x.hint}>{t('6–16 位字母或数字，每 30 天可修改一次；旧链接仍可使用。', '6–16 letters or digits. Change once every 30 days; previous links remain valid.')}</p>
    <button type="submit" className={x.primary} disabled={busy} aria-busy={busy}>{busy ? t('保存中', 'Saving') : t('保存邀请码', 'Save code')}</button>
  </form>
}

export function ReferralScreen({ query = '' }: { query?: string }) {
  const { locale } = useI18n(), zh = locale.startsWith('zh')
  const t: Translate = (cn, en) => zh ? cn : en
  const [tab, setTab] = useState<Tab>('team'), [level, setLevel] = useState('all'), [page, setPage] = useState(1)
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState('')
  const [saving, setSaving] = useState(false), [editError, setEditError] = useState('')
  const [claiming, setClaiming] = useState(false), [claimNote, setClaimNote] = useState(''), [claimError, setClaimError] = useState('')
  const claimKey = useRef<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null), copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const theme = useHostTheme(rootRef)
  const balanceId = useId()
  const me = useQuery('referral:v2:me', referralMe, { staleTime: 30_000 })
  const summary = useQuery('referral:v2:summary', referralSummary, { staleTime: 30_000 })
  const members = useQuery(tab === 'team' ? `referral:v2:members:${page}:${level}` : null, () => referralInvitees(page, level), { staleTime: 30_000 })
  const awards = useQuery(tab === 'rewards' ? `referral:v2:awards:${page}` : null, () => referralAwards(page), { staleTime: 30_000 })
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
  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/r/${code}` : ''
  const sum = summary.data
  const unit = sum?.currency || 'USDT'
  const money = (atomic?: string) => fmtAtomic(atomic, sum?.decimals ?? 6, '', 2).trim()
  const levelCount = (value: number) => sum ? String(sum.levels.find(row => row.level === value)?.count ?? 0) : '—'
  const totalCount = sum ? String(sum.levels.filter(row => row.level >= 1 && row.level <= 3).reduce((total, row) => total + row.count, 0)) : '—'
  const states: Record<string, string> = { earned: t('可领取', 'Claimable'), claimed: t('已领取', 'Claimed') }
  const kinds: Record<string, string> = { purchase: t('买入返佣', 'Purchase rebate'), fee: t('手续费返佣', 'Fee rebate') }
  const claimable = sum ? BigInt(sum.balances.available) > BigInt(0) : false
  const list = tab === 'team' ? members : awards
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
      setClaimNote(t(`已领取 ${money(result.data.amountAtomic)} ${unit} 到可用余额`, `${money(result.data.amountAtomic)} ${unit} added to your available balance`))
      await invalidate(['referral:v2:summary', 'referral:v2:awards', 'wallet:', 'portfolio:', 'home:'])
    } catch {
      if (mounted.current) setClaimError(t('领取失败，请重试', 'Unable to claim. Please try again.'))
    } finally { if (mounted.current) setClaiming(false) }
  }

  const copyLabel = copied ? t('已复制', 'Copied') : t('复制链接', 'Copy link')
  const CopyIcon = copied ? Check : Copy
  const retryLabel = t('重试', 'Retry')

  return <div ref={rootRef} className={`${x.ref} ${x.screen}`}>
    <MaisonPage page="referral" topbar={<header className={x.topbar}>
      <button type="button" className={x.iconBtn} aria-label={t('返回', 'Back')} onClick={() => backOr('/profile')}><ArrowLeft size={22} strokeWidth={1.75} /></button>
      <h1>{t('推荐奖励', 'Referrals')}</h1>
      <button type="button" className={x.iconBtn} aria-label={t('查看邀请规则', 'View invitation rules')} aria-haspopup="dialog" onClick={() => setSheet('rules')}><CircleHelp size={21} strokeWidth={1.75} /></button>
    </header>}>
      <section className={x.balance} aria-labelledby={balanceId}>
        <div className={x.balanceHead}>
          <h2 id={balanceId}>{t('可领取奖励', 'Available rewards')}</h2>
          {sum && <button type="button" className={x.chipButton} aria-haspopup="dialog" onClick={() => setSheet('rules')}>{t('查看规则', 'View rules')}</button>}
        </div>
        {summary.error
          ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={summary.error.message} retry={summary.refetch} retryLabel={retryLabel} />
          : !sum ? <Skeleton rows={2} /> : <>
            <p className={x.amount}><span>{money(sum.balances.available)}</span><small>{unit}</small></p>
            <dl className={x.meta}>
              <div><dt>{t('已领取', 'Claimed')}</dt><dd>{money(sum.balances.claimed)} <small>{unit}</small></dd></div>
              <div><dt>{t('累计奖励', 'Total earned')}</dt><dd>{money(sum.balances.total)} <small>{unit}</small></dd></div>
            </dl>
            {sum.payoutsEnabled && <div className={x.actions}>
              <button type="button" className={x.primary} disabled={!claimable || claiming} aria-busy={claiming} onClick={() => void claim()}>
                {claiming ? t('领取中', 'Claiming') : t('领取到余额', 'Claim to balance')}
              </button>
            </div>}
            <p className={x.feedback} role="status">{claimNote}</p>
            {claimError && <p className={x.error} role="alert">{claimError}</p>}
          </>}
      </section>

      <section className={x.invite} aria-label={t('我的邀请', 'My invitation')}>
        {me.error
          ? <StateBlock tone="error" title={t('邀请码暂不可用', 'Invitation code unavailable')} body={me.error.message} retry={me.refetch} retryLabel={retryLabel} />
          : !code ? <Skeleton rows={2} /> : <>
            <div className={x.inviteRow}>
              <div className={x.inviteId}>
                <div className={x.inviteLabel}>
                  <span>{t('我的邀请码', 'My invitation code')}</span>
                  <button type="button" className={x.textBtn} aria-label={t('修改邀请码', 'Edit invitation code')} aria-haspopup="dialog" onClick={openEdit}><Pencil size={14} strokeWidth={1.75} aria-hidden="true" />{t('修改', 'Edit')}</button>
                </div>
                <p className={x.code} data-len={lengthClass(code)}>{code}</p>
                <p className={x.link}>{link}</p>
              </div>
              <button type="button" className={x.qr} aria-label={t('放大邀请二维码', 'Enlarge invitation QR code')} aria-haspopup="dialog" onClick={() => setSheet('qr')}>
                <QRCodeSVG value={link} size={72} marginSize={2} level="M" bgColor="#ffffff" fgColor="#000000" title={t('邀请链接二维码', 'Invitation QR code')} />
              </button>
            </div>
            <div className={x.actions}>
              <button type="button" className={x.primary} onClick={() => void copy()}><CopyIcon size={18} strokeWidth={1.75} aria-hidden="true" />{copyLabel}</button>
              <button type="button" className={x.secondary} onClick={() => void share()}><Share2 size={17} strokeWidth={1.75} aria-hidden="true" />{t('分享', 'Share')}</button>
            </div>
            <p className={x.feedback} role="status">{copied ? t('邀请链接已复制', 'Invitation link copied') : ''}</p>
            {copyError && <p className={x.error} role="alert">{copyError}</p>}
            <button type="button" className={x.posterEntry} aria-haspopup="dialog" disabled={!sum || !!summary.error || summary.loading || me.loading} onClick={() => setSheet('poster')}>
              <ImagePlus size={20} strokeWidth={1.65} aria-hidden="true" />
              <span>{posterCopy[locale].create}</span><ArrowUpRight size={18} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </>}
      </section>

      <section className={x.records} aria-label={t('推荐记录', 'Referral records')}>
        <div className={x.tabs} role="group" aria-label={t('记录类型', 'Record type')}>
          {([['team', t('我的团队', 'My team')], ['rewards', t('奖励记录', 'Rewards')]] as const).map(([key, label]) =>
            <button key={key} type="button" className={x.tabBtn} aria-pressed={tab === key} onClick={() => { setTab(key); setPage(1) }}>{label}</button>)}
        </div>
        {tab === 'team' && <div className={x.levels} role="group" aria-label={t('团队层级', 'Team level')}>
          {([['all', t('全部', 'All'), totalCount], ['1', t('一级', 'Level 1'), levelCount(1)], ['2', t('二级', 'Level 2'), levelCount(2)], ['3', t('三级', 'Level 3'), levelCount(3)]] as const).map(([value, label, count]) =>
            <button key={value} type="button" className={x.levelBtn} aria-pressed={level === value} onClick={() => { setLevel(value); setPage(1) }}><span>{label}</span><b>{count}</b></button>)}
        </div>}
        {list.error
          ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={list.error.message} retry={list.refetch} retryLabel={retryLabel} />
          : !list.data ? <Skeleton rows={3} /> : <>
            {!list.data.items.length
              ? <p className={x.empty} role="status">{tab === 'rewards' ? t('暂无奖励记录', 'No rewards yet') : level === 'all' ? t('暂无邀请记录', 'No invitations yet') : t('该层级暂无成员', 'No members at this level')}</p>
              : tab === 'team'
                ? <ul className={x.list}>{members.data?.items.map((row, index) => <li className={x.row} key={`${row.memberLabel}:${index}`}>
                  <div><b>{row.memberLabel}</b><span>{t(`第 ${row.level} 级`, `Level ${row.level}`)}</span></div>
                  <time dateTime={row.boundAt}>{fmtDate(row.boundAt, locale)}</time>
                </li>)}</ul>
                : <ul className={x.list}>{awards.data?.items.map(row => <li className={x.row} key={row.id}>
                  <div><b className={x.reward}>{fmtAtomic(row.amountAtomic, row.decimals, row.currency)}</b><span>{kinds[row.kind] ?? row.kind} · {t(`第 ${row.level} 级`, `Level ${row.level}`)} · {row.memberLabel} · {fmtDate(row.occurredAt, locale)}</span></div>
                  <span className={x.state}>{states[row.state] ?? row.state}</span>
                </li>)}</ul>}
            {list.data.total > PAGE_SIZE && <nav className={x.pager} aria-label={t('分页', 'Pagination')}>
              <button type="button" className={x.pagerBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('上一页', 'Previous')}</button>
              <span>{page} / {pages}</span>
              <button type="button" className={x.pagerBtn} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{t('下一页', 'Next')}</button>
            </nav>}
          </>}
      </section>
    </MaisonPage>

    {sheet === 'rules' && <ReferralSheet tall title={t('邀请规则', 'Invitation rules')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      {sum
        ? <ReferralRules rules={sum.rules} locale={locale} />
        : summary.error
          ? <StateBlock tone="error" title={t('规则暂不可用', 'Rules unavailable')} body={summary.error.message} retry={summary.refetch} retryLabel={retryLabel} />
          : <Skeleton rows={3} />}
    </ReferralSheet>}
    {sheet === 'qr' && code && <ReferralSheet title={t('扫码邀请', 'Scan to join')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      <div className={x.qrSheet}>
        <div className={x.qrBig}><QRCodeSVG value={link} size={216} marginSize={2} level="M" bgColor="#ffffff" fgColor="#000000" title={t('邀请链接二维码', 'Invitation QR code')} /></div>
        <p className={x.code} data-len={lengthClass(code)}>{code}</p>
        <p className={x.linkWrap}>{link}</p>
        <button type="button" className={x.primary} onClick={() => void copy()}><CopyIcon size={18} strokeWidth={1.75} aria-hidden="true" />{copyLabel}</button>
        <p className={x.feedback} role="status">{copied ? t('邀请链接已复制', 'Invitation link copied') : ''}</p>
        {copyError && <p className={x.error} role="alert">{copyError}</p>}
      </div>
    </ReferralSheet>}
    {sheet === 'edit' && code && <ReferralSheet title={t('修改邀请码', 'Edit invitation code')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      <CodeForm code={code} busy={saving} error={editError} onSave={next => void save(next)} onDraftChange={() => setEditError('')} t={t} />
    </ReferralSheet>}
    {sheet === 'poster' && code && sum && <ReferralPosterComposer key={code} code={code} summary={sum} locale={locale} theme={theme} inertRef={rootRef} onClose={closeSheet} sourceReady={!summary.loading && !me.loading && !summary.error && !me.error} />}
  </div>
}
