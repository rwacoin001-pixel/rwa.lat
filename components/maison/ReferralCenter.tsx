'use client'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, Check, CircleHelp, Copy, Pencil, Share2, ImagePlus } from 'lucide-react'
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
import { displayInviteCode } from '@/lib/referral-invite'
import { porcelainAvatar } from '@/components/community-avatar'
import { Guilloche } from './Guilloche'
import { nativeCan, nativeShare } from '@/lib/native-app'
import x from './referral.module.css'
import c from './referral-card.module.css'

type Tab = 'team' | 'rewards'
type SheetKind = 'rules' | 'qr' | 'edit' | 'poster' | null
type Translate = (cn: string, en: string) => string

const PAGE_SIZE = 20
const CODE_PATTERN = /^[A-Za-z0-9]{6,16}$/
const ReferralPosterComposer = dynamic(() => import('./ReferralPosterComposer').then(module => module.ReferralPosterComposer), { ssr: false })
const lengthClass = (code: string) => code.length <= 8 ? 's' : code.length <= 12 ? 'm' : 'l'

/** One rate per level, side by side; never summed into a single figure. */
function Rates({ rates, t, pct }: { rates: number[]; t: Translate; pct: (bps: number) => string }) {
  return <div className={c.rates}>{rates.slice(0, 3).map((rate, i) => <div key={i}><span>{t(['一级', '二级', '三级'][i], `Level ${i + 1}`)}</span><b>{pct(rate)}</b></div>)}</div>
}

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
  const funnel = useQuery('referral:v2:funnel', referralFunnel, { staleTime: 60_000 })
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

  return <div ref={rootRef} className={`${x.ref} ${x.screen} ${c.page}`}>
    <Shell embedded={embedded} topbar={<header className={`${x.topbar} ${c.topbarPlain}`}>
      <button type="button" className={x.iconBtn} aria-label={t('返回', 'Back')} onClick={() => backOr('/profile')}><ArrowLeft size={22} strokeWidth={1.75} /></button>
      <h1>{t('邀请好友', 'Invite friends')}</h1>
      <button type="button" className={x.iconBtn} aria-label={t('查看邀请规则', 'View invitation rules')} aria-haspopup="dialog" onClick={() => setSheet('rules')}><CircleHelp size={21} strokeWidth={1.75} /></button>
    </header>}>
      <section className={c.stage} aria-label={t('我的邀请卡', 'My invitation card')}>
        {me.error
          ? <StateBlock tone="error" title={t('邀请码暂不可用', 'Invitation code unavailable')} body={me.error.message} retry={me.refetch} retryLabel={retryLabel} />
          : !code ? <div className={c.card} aria-busy="true"><Skeleton rows={3} /></div> : <>
            <article className={c.card}>
              <Guilloche className={c.guilloche} />
              <span className={c.foil} aria-hidden="true" />
              <div className={c.cardHead}>
                <span className={c.brand}><b>A-REIT</b>{t('邀请卡', 'Invitation')}</span>
                <span className={c.chip} aria-hidden="true" />
              </div>
              <div className={c.codeBlock}>
                <p className={c.codeLabel}>{t('我的邀请码', 'My invitation code')}
                  <button type="button" className={c.edit} aria-label={t('修改邀请码', 'Edit invitation code')} aria-haspopup="dialog" onClick={openEdit}><Pencil size={11} strokeWidth={1.8} aria-hidden="true" />{t('修改', 'Edit')}</button>
                </p>
                <p className={c.code} data-len={lengthClass(code)} dir="ltr">{displayInviteCode(code)}</p>
              </div>
              <div className={c.cardFoot}>
                <p><small>{t('专属链接', 'Your link')}</small><span dir="ltr">{link.replace(/^https?:\/\//, '')}</span></p>
                <button type="button" className={c.qr} aria-label={t('放大邀请二维码', 'Enlarge invitation QR code')} aria-haspopup="dialog" onClick={() => setSheet('qr')}>
                  <QRCodeSVG value={link} size={50} marginSize={0} level="M" bgColor="#ffffff" fgColor="#1c1a15" title={t('邀请链接二维码', 'Invitation QR code')} />
                </button>
              </div>
            </article>
            <div className={c.actions}>
              <button type="button" onClick={() => void copy()}><CopyIcon size={17} strokeWidth={1.8} aria-hidden="true" />{copyLabel}</button>
              <button type="button" onClick={() => void share()}><Share2 size={17} strokeWidth={1.8} aria-hidden="true" />{t('分享', 'Share')}</button>
              <button type="button" aria-haspopup="dialog" disabled={!sum || !!summary.error || summary.loading || me.loading} onClick={() => setSheet('poster')}><ImagePlus size={17} strokeWidth={1.8} aria-hidden="true" />{t('海报', 'Poster')}</button>
            </div>
            {/* What sharing did (2026-10-28): opens → sign-ups → first Koala Quant subscriptions, last 30 days. */}
            {funnel.data && <p className={c.funnel}>{t('近 30 天', 'Last 30 days')}<b>{t(`链接打开 ${funnel.data.opened.last30d} 次`, `${funnel.data.opened.last30d} opens`)}</b><i aria-hidden="true">·</i><b>{t(`注册 ${funnel.data.registered.last30d} 人`, `${funnel.data.registered.last30d} sign-ups`)}</b><i aria-hidden="true">·</i><b>{t(`首次申购 ${funnel.data.subscribed.last30d} 人`, `${funnel.data.subscribed.last30d} first subscriptions`)}</b></p>}
            <p className={c.feedback} role="status" data-tone={copyError ? 'error' : undefined}>{copyError || (copied ? t('邀请链接已复制', 'Invitation link copied') : '')}</p>
          </>}
      </section>

      <section className={c.panel} aria-labelledby={balanceId}>
        <h2 id={balanceId} className={c.eyebrow}>{t('可领取奖励', 'Claimable rewards')}{sum && <button type="button" aria-haspopup="dialog" onClick={() => setSheet('rules')}>{t('规则', 'Rules')}</button>}</h2>
        {summary.error
          ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={summary.error.message} retry={summary.refetch} retryLabel={retryLabel} />
          : !sum ? <Skeleton rows={2} /> : <>
            <p className={c.amount}><span>{money(sum.balances.available)}</span><small>{unit}</small></p>
            <dl className={c.meta}>
              <div><dt>{t('已领取', 'Claimed')}</dt><dd>{money(sum.balances.claimed)}</dd></div>
              <div><dt>{t('累计奖励', 'Total earned')}</dt><dd>{money(sum.balances.total)}</dd></div>
              <div><dt>{t('邀请人数', 'Invited')}</dt><dd>{totalCount}</dd></div>
            </dl>
            {sum.payoutsEnabled && <button type="button" className={c.claim} disabled={!claimable || claiming} aria-busy={claiming} onClick={() => void claim()}>
              {claiming ? t('领取中', 'Claiming') : t('领取到可用余额', 'Claim to available balance')}
            </button>}
            <p className={c.claimHint} role="status">{claimNote || t('买入奖励与手续费返佣需手动领取；团队月结自动到账。', 'Purchase and fee rewards are claimed here; team settlement is credited automatically.')}</p>
            {claimError && <p className={x.error} role="alert">{claimError}</p>}
          </>}
      </section>

      {sum && <section className={c.panel} aria-labelledby={`${balanceId}-sources`}>
        <h2 id={`${balanceId}-sources`} className={c.eyebrow}>{t('奖励来源', 'How rewards are earned')}<b>{t(`规则 V${sum.rules.version}`, `Rules v${sum.rules.version}`)}</b></h2>
        <ol className={c.ledger}>
          {sum.purchaseRewardsEnabled !== false && <li>
            <h3>{t('买入奖励', 'Purchase rewards')}</h3><span className={c.tag}>{t('手动领取', 'Claim')}</span>
            <p>{t('好友买入并成交后，按成交金额一次性计入；考拉量化仅首次申购计入。', 'One-time, on the settled amount of an invitee’s purchase. Koala Quant counts the first subscription only.')}</p>
            <Rates rates={sum.rules.holdingRatesBps} t={t} pct={pct} />
          </li>}
          {sum.feeRewardsEnabled !== false && <li>
            <h3>{t('手续费返佣', 'Fee rebates')}</h3><span className={c.tag}>{t('手动领取', 'Claim')}</span>
            <p>{t('按平台实际收取的合格手续费计算，不含本金、充值和余额。', 'On eligible fees the platform actually collects. Principal, deposits and balances never count.')}</p>
            <Rates rates={sum.rules.feeRatesBps} t={t} pct={pct} />
          </li>}
          <li>
            <h3>{t('团队月结', 'Monthly team settlement')}</h3><span className={c.tag} data-tone="auto">{t('自动到账', 'Automatic')}</span>
            <p>{t('按月净合格手续费分段累进计算，审核发放后直接进入可用余额。', 'Progressive on monthly net eligible fees; credited to available balance once reviewed and funded.')}</p>
          </li>
        </ol>
      </section>}

      {sum && <ReferralTeamRewards locale={locale} tiers={sum.rules.teamTiers} />}

      <section className={c.panel} aria-label={t('团队与奖励记录', 'Team and reward records')}>
        <div className={c.segmented} role="group" aria-label={t('记录类型', 'Record type')}>
          {([['team', t(`团队成员 ${totalCount}`, `Members ${totalCount}`)], ['rewards', t('奖励记录', 'Rewards')]] as const).map(([key, label]) =>
            <button key={key} type="button" aria-pressed={tab === key} onClick={() => { setTab(key); setPage(1) }}>{label}</button>)}
        </div>
        {tab === 'team' && <div className={c.levels} role="group" aria-label={t('团队层级', 'Team level')}>
          {([['all', t('全部', 'All'), totalCount], ['1', t('一级', 'Level 1'), levelCount(1)], ['2', t('二级', 'Level 2'), levelCount(2)], ['3', t('三级', 'Level 3'), levelCount(3)]] as const).map(([value, label, count]) =>
            <button key={value} type="button" aria-pressed={level === value} onClick={() => { setLevel(value); setPage(1) }}>{label}<b>{count}</b></button>)}
        </div>}
        {list.error
          ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={list.error.message} retry={list.refetch} retryLabel={retryLabel} />
          : !list.data ? <Skeleton rows={3} /> : <>
            {!list.data.items.length
              ? <p className={c.empty} role="status">{tab === 'rewards' ? t('暂无奖励记录', 'No rewards yet') : level === 'all' ? t('分享邀请卡，好友注册后会出现在这里', 'Share your card. Friends who sign up appear here') : t('该层级暂无成员', 'No members at this level')}</p>
              : tab === 'team'
                ? <ul className={c.rows}>{members.data?.items.map((row, index) => <li key={`${row.memberLabel}:${index}`}>
                  <img className={c.monogram} data-level={row.level} src={porcelainAvatar(row.memberLabel)} alt="" width={36} height={36} aria-hidden="true" />
                  <div><b dir="ltr">{t('用户', 'Member')} {row.memberLabel.slice(0, 6).toUpperCase()}</b><span>{t(`第 ${row.level} 级`, `Level ${row.level}`)}</span></div>
                  <time dateTime={row.boundAt}>{fmtDate(row.boundAt, locale)}</time>
                </li>)}</ul>
                : <ul className={c.rows}>{awards.data?.items.map(row => <li key={row.id}>
                  <img className={c.monogram} data-level={row.level} src={porcelainAvatar(row.memberLabel)} alt="" width={36} height={36} aria-hidden="true" />
                  <div><b>{fmtAtomic(row.amountAtomic, row.decimals, row.currency)}</b><span>{kinds[row.kind] ?? row.kind} · {t(`第 ${row.level} 级`, `Level ${row.level}`)} · {fmtDate(row.occurredAt, locale)}</span></div>
                  <span className={c.state}>{states[row.state] ?? row.state}</span>
                </li>)}</ul>}
            {list.data.total > PAGE_SIZE && <nav className={c.pager} aria-label={t('分页', 'Pagination')}>
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('上一页', 'Previous')}</button>
              <span>{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{t('下一页', 'Next')}</button>
            </nav>}
          </>}
      </section>
      <p className={c.disclaimer}>{t('奖励比例按层级分别计算，不代表投资收益，也不构成收益承诺。', 'Rates apply per level separately. They are not investment returns and carry no promise of income.')}</p>
    </Shell>

    {sheet === 'rules' && <ReferralSheet tall title={t('邀请规则', 'Invitation rules')} closeLabel={t('关闭', 'Close')} theme={theme} inertRef={rootRef} onClose={closeSheet}>
      {sum
        ? <ReferralRules rules={sum.rules} locale={locale} teamEnabled={sum.teamSettlementEnabled} />
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
