'use client'
import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Copy, History, LockKeyhole, Share2, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { referralMe, referralSummary, referralInvitees, referralAwards, changeReferralCode } from '@/lib/api/referral'
import { backOr } from '@/lib/maison-nav'
import { MaisonPage, StateBlock, Skeleton } from './primitives'
import { fmtAtomic, fmtDate } from './format'
import { ReferralRules } from './ReferralRules'
import x from './referral.module.css'
const Legacy = dynamic(() => import('./LegacyReferralScreen').then(m => m.LegacyReferralScreen))
type Tab = 'team' | 'rewards' | 'rules' | 'legacy'

export function ReferralScreen({ query = '' }: { query?: string }) {
  const { locale } = useI18n(), zh = locale.startsWith('zh')
  const t = (cn: string, en: string) => zh ? cn : en
  const [tab, setTab] = useState<Tab>('team'), [level, setLevel] = useState('all'), [page, setPage] = useState(1)
  const [copied, setCopied] = useState(false), [editing, setEditing] = useState(false), [code, setCode] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const rulesAnchor = useRef<HTMLElement>(null)
  const me = useQuery('referral:v2:me', referralMe, { staleTime: 30_000 })
  const summary = useQuery('referral:v2:summary', referralSummary, { staleTime: 30_000 })
  const members = useQuery(tab === 'team' ? `referral:v2:members:${page}:${level}` : null, () => referralInvitees(page, level), { staleTime: 30_000 })
  const awards = useQuery(tab === 'rewards' ? `referral:v2:awards:${page}` : null, () => referralAwards(page), { staleTime: 30_000 })
  const link = me.data && typeof window !== 'undefined' ? `${window.location.origin}/r/${me.data.code}` : ''
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setError('') } catch { setError(t('无法复制，请长按链接复制', 'Unable to copy. Select the link to copy.')) } }
  const share = async () => { if (!navigator.share) return copy(); try { await navigator.share({ title: 'RWA.LAT', url: link }) } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) await copy() } }
  const save = async () => { if (busy) return; setBusy(true); setError(''); try { const result = await changeReferralCode(code); if (!result.ok) { setError(result.error.message); return }; setEditing(false); setCopied(false); await invalidate('referral:v2:me') } finally { setBusy(false) } }
  const showRules = () => { setTab('rules'); setPage(1); requestAnimationFrame(() => rulesAnchor.current?.scrollIntoView({ block: 'start' })) }
  const money = (atomic?: string) => fmtAtomic(atomic, 6, '', 2).trim()
  const list = tab === 'team' ? members : awards
  const states: Record<string, string> = { candidate: t('待计算', 'Candidate'), pending_review: t('待审核', 'Pending review'), approved: t('已批准', 'Approved'), available: t('可领取', 'Available'), frozen: t('已冻结', 'Frozen'), claimed_credit: t('已领额度', 'Credit claimed'), claimed_cash: t('已领现金', 'Cash claimed'), rejected: t('已拒绝', 'Rejected'), revoked: t('已撤销', 'Revoked') }
  if (tab === 'legacy') return <><button className={x.legacyBack} onClick={() => setTab('team')}><ArrowLeft size={16} />{t('返回推荐中心', 'Back to referrals')}</button><Legacy query={query} /></>
  return <div className={x.screen}><MaisonPage page="referral" topbar={<header className={x.topbar}><button aria-label={t('返回', 'Back')} onClick={() => backOr('/profile')}><ArrowLeft size={21} strokeWidth={1.5} /></button><h1>{t('推荐奖励', 'Referrals')}</h1><button aria-label={t('查看邀请规则', 'View invitation rules')} onClick={showRules}><CircleHelp size={21} strokeWidth={1.5} /></button></header>}>
    <section className={x.pass} aria-label={t('我的邀请码', 'My invitation code')}><p className={x.brand}>RWA.LAT</p>
      {me.error ? <StateBlock tone="error" title={t('邀请码暂不可用', 'Invitation code unavailable')} body={me.error.message} retry={me.refetch} retryLabel={t('重试', 'Retry')} /> : !me.data ? <Skeleton rows={2} /> : <>
        <div className={x.passMain}><div className={x.codeBlock}><p className={x.eyebrow}>{t('我的邀请码', 'My invitation code')}</p><div className={x.code} data-long={me.data.code.length > 10}>{me.data.code}</div></div><div className={x.qr}><QRCodeSVG value={link} size={56} marginSize={1} title={t('邀请链接二维码', 'Invitation QR code')} /></div></div>
        <div className={x.linkRow}><span>{link}</span><button onClick={() => void copy()} aria-label={copied ? t('已复制链接', 'Link copied') : t('复制邀请链接', 'Copy invitation link')}>{copied ? <Check size={16} /> : <Copy size={16} strokeWidth={1.5} />}</button></div>
        <div className={x.passActions}><button className={x.share} onClick={() => void share()}><Share2 size={17} strokeWidth={1.5} />{t('分享邀请', 'Share invitation')}</button><button className={x.edit} aria-expanded={editing} onClick={() => { setCode(me.data!.code); setEditing(!editing); setError('') }}>{t('修改邀请码', 'Edit code')}<ArrowRight size={14} /></button></div>
        {copied && <span className={x.copyFeedback} role="status">{t('邀请链接已复制', 'Invitation link copied')}</span>}
        {editing && <form className={x.codeForm} onSubmit={e => { e.preventDefault(); void save() }}><label htmlFor="referral-code">{t('新邀请码', 'New invitation code')}</label><div><input id="referral-code" value={code} minLength={6} maxLength={16} pattern="[a-zA-Z0-9]{6,16}" onChange={e => setCode(e.target.value)} required autoComplete="off" spellCheck={false} /><button disabled={busy}>{busy ? t('保存中', 'Saving') : t('保存', 'Save')}</button></div><small>{t('6–16 位字母或数字，每 30 天可修改一次；旧链接仍可使用。', '6–16 letters or digits. Change once every 30 days; previous links remain valid.')}</small></form>}
      </>}
    </section>
    {error && <p className={x.error} role="alert">{error}</p>}
    <section className={x.balance} aria-label={t('奖励余额', 'Reward balances')}><h2>{t('可领取奖励', 'Available rewards')}</h2>
      {summary.error ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={summary.error.message} retry={summary.refetch} retryLabel={t('重试', 'Retry')} /> : !summary.data ? <Skeleton rows={2} /> : <><div className={x.balanceValue}><strong>{money(summary.data.balances.available)}</strong><span>USDT</span></div><div className={x.balanceMeta}><div><span>{t('待审核', 'Pending review')}</span><b>{money(summary.data.balances.pending)} <small>USDT</small></b></div><div><span>{t('已冻结', 'Frozen')}</span><b>{money(summary.data.balances.frozen)} <small>USDT</small></b></div></div><div className={x.claimStatus}><LockKeyhole size={17} strokeWidth={1.5} /><span>{t('奖励领取尚未开放', 'Reward claims are not open yet')}</span></div></>}
    </section>
    <section ref={rulesAnchor} className={x.records}>
      <nav className={x.tabs} aria-label={t('推荐记录', 'Referral records')}>{([['team', t('我的团队', 'My team')], ['rewards', t('奖励明细', 'Rewards')], ['rules', t('邀请规则', 'Invitation rules')]] as const).map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => { setTab(key); setPage(1) }}>{label}</button>)}</nav>
      {tab === 'team' && <><div className={x.levels}>{[1, 2, 3].map(level => <div key={level}><span>{t('第', 'Level ')}{level}{t('级', '')}</span><b>{summary.data ? summary.data.levels.find(r => r.level === level)?.count ?? 0 : '—'}</b></div>)}</div><label className={x.levelFilter}><span>{t('层级', 'Level')}</span><select aria-label={t('团队层级', 'Team level')} value={level} onChange={e => { setLevel(e.target.value); setPage(1) }}>{['all', '1', '2', '3'].map(v => <option key={v} value={v}>{v === 'all' ? t('全部层级', 'All levels') : t(`第 ${v} 级`, `Level ${v}`)}</option>)}</select><ChevronDown size={16} /></label></>}
      {(tab === 'team' || tab === 'rewards') && (list.error ? <StateBlock tone="error" title={t('加载失败', 'Unable to load')} body={list.error.message} retry={list.refetch} retryLabel={t('重试', 'Retry')} /> : !list.data ? <Skeleton rows={2} /> : <>{!list.data.items.length ? <div className={x.empty}><Users size={31} strokeWidth={1.25} /><p>{tab === 'team' ? t('暂无邀请记录', 'No invitations yet') : t('暂无奖励记录', 'No rewards yet')}</p></div> : <div className={x.scroll}><table className={x.table}><thead><tr><th>{tab === 'team' ? t('成员', 'Member') : t('金额', 'Amount')}</th><th>{t('层级', 'Level')}</th><th>{tab === 'team' ? t('绑定日期', 'Bound on') : t('状态', 'State')}</th></tr></thead><tbody>{tab === 'team' ? members.data?.items.map((r, i) => <tr key={`${r.memberLabel}:${i}`}><td>{r.memberLabel}…</td><td>{r.level}</td><td>{fmtDate(r.boundAt, locale)}</td></tr>) : awards.data?.items.map(r => <tr key={r.id}><td>{fmtAtomic(r.amountAtomic, r.decimals, r.currency)}<small>v{r.settingsVersion} · {fmtDate(r.occurredAt, locale)}</small></td><td>{r.level}</td><td>{states[r.state] ?? r.state}</td></tr>)}</tbody></table></div>}{list.data.total > 20 && <div className={x.pager}><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('上一页', 'Previous')}</button><span>{page} / {Math.ceil(list.data.total / 20)}</span><button disabled={page * 20 >= list.data.total} onClick={() => setPage(p => p + 1)}>{t('下一页', 'Next')}</button></div>}</>)}
      {tab === 'rules' && (summary.data ? <ReferralRules rules={summary.data.rules} locale={locale} /> : <StateBlock tone={summary.error ? 'error' : 'unavailable'} title={t('规则暂不可用', 'Rules unavailable')} retry={summary.refetch} retryLabel={t('重试', 'Retry')} />)}
    </section>
    <div className={x.footerLinks}>{tab !== 'rules' && <button onClick={showRules}><BookOpen size={20} strokeWidth={1.5} /><span>{t('查看完整邀请规则', 'View full invitation rules')}</span><ArrowRight size={17} /></button>}<button onClick={() => setTab('legacy')}><History size={20} strokeWidth={1.5} /><span>{t('历史邀请与奖励', 'Legacy invitations & rewards')}</span><ArrowRight size={17} /></button></div>
  </MaisonPage></div>
}
