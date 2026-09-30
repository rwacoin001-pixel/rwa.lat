'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Copy, Share2, Check, Users, Gift } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { referralMe, referralSummary, referralInvitees, referralAwards, changeReferralCode } from '@/lib/api/referral'
import { backOr } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, StateBlock, Skeleton, maison as s } from './primitives'
import { fmtAtomic, fmtDate } from './format'
import x from './referral.module.css'
const Legacy=dynamic(()=>import('./LegacyReferralScreen').then(m=>m.LegacyReferralScreen))

export function ReferralScreen({query=''}:{query?:string}) {
  const {locale}=useI18n(), zh=locale.startsWith('zh')
  const t=(cn:string,en:string)=>zh?cn:en
  const [tab,setTab]=useState('team'),[level,setLevel]=useState('all'),[page,setPage]=useState(1)
  const [copied,setCopied]=useState(false),[editing,setEditing]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const me=useQuery('referral:v2:me',referralMe,{staleTime:30_000})
  const summary=useQuery('referral:v2:summary',referralSummary,{staleTime:30_000})
  const members=useQuery(`referral:v2:members:${page}:${level}`,()=>referralInvitees(page,level),{staleTime:30_000})
  const awards=useQuery(`referral:v2:awards:${page}`,()=>referralAwards(page),{staleTime:30_000})
  const link=me.data&&typeof window!=='undefined'?`${window.location.origin}/r/${me.data.code}`:''
  const copy=async()=>{try{await navigator.clipboard.writeText(link);setCopied(true)}catch{setError(t('无法复制，请长按链接复制','Unable to copy. Select the link to copy.'))}}
  const save=async()=>{setBusy(true);setError('');const result=await changeReferralCode(code);setBusy(false);if(!result.ok){setError(result.error.message);return}setEditing(false);invalidate('referral:v2:me')}
  if(tab==='legacy') return <><div className={x.actions} style={{padding:16}}><button onClick={()=>setTab('team')}>{t('返回推荐中心','Back to referrals')}</button></div><Legacy query={query}/></>
  const list=tab==='team'?members:awards
  return <MaisonPage page="referral" topbar={<RwaTopbar screen="referral" template="T-Child" l1="back" title={t('推荐奖励','Referrals')} onBack={()=>backOr('/profile')}/> }>
    <header className={s.hero}><p className={s.kicker}>REFERRALS</p><h1 className={s.display}>{t('推荐','Invite')} <em>{t('与奖励','& earn')}</em></h1></header>
    <section className={`${x.card} ${x.pass}`} aria-label={t('我的邀请码','My invitation code')}>
      <small>{t('我的邀请码','My invitation code')}</small>
      {me.error?<StateBlock tone="error" title={t('邀请码暂不可用','Invitation code unavailable')} body={me.error.message} retry={me.refetch} retryLabel={t('重试','Retry')}/>:!me.data?<Skeleton rows={1}/>:<>
        <div className={x.code}>{me.data.code}</div><p className={x.status} style={{overflowWrap:'anywhere'}}>{link}</p>
        <div className={x.actions}><button onClick={()=>void copy()}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?t('已复制','Copied'):t('复制链接','Copy link')}</button><button onClick={()=>{if(navigator.share)void navigator.share({url:link}).catch(()=>{});else void copy()}}><Share2 size={14}/> {t('分享','Share')}</button><button onClick={()=>{setCode(me.data!.code);setEditing(!editing)}}>{t('修改邀请码','Edit code')}</button></div>
        <div className={x.qr}><QRCodeSVG value={link} size={104} title={t('邀请链接二维码','Invitation QR code')}/></div>
        {editing&&<form className={x.field} onSubmit={e=>{e.preventDefault();void save()}}><input aria-label={t('新邀请码','New code')} value={code} minLength={6} maxLength={16} pattern="[a-zA-Z0-9]{6,16}" onChange={e=>setCode(e.target.value)} required/><button disabled={busy}>{t('保存','Save')}</button><small>{t('6–16 位字母或数字，每 30 天可修改一次','6–16 letters or digits. Change once every 30 days.')}</small></form>}
      </>}
    </section>
    {error&&<p className={x.error} role="alert">{error}</p>}
    <SectionHead index="01" title={t('奖励余额','Reward balances')}/>
    {summary.error?<StateBlock tone="error" title={t('加载失败','Unable to load')} body={summary.error.message} retry={summary.refetch} retryLabel={t('重试','Retry')}/>:!summary.data?<Skeleton rows={2}/>:<><div className={x.metrics}>{(['pending','available','frozen'] as const).map((key,i)=><div key={key}><small>{[t('待审核','Pending review'),t('可领取','Available'),t('已冻结','Frozen')][i]}</small><b>{fmtAtomic(summary.data!.balances[key],6,'USDT')}</b></div>)}</div><p className={x.status}>{t('奖励领取尚未开放','Reward claims are not available yet')}</p><div className={x.actions}><button disabled><Gift size={14}/> {t('领取额度','Claim credit')}</button><button disabled>{t('领取现金','Claim cash')}</button></div></>}
    <nav className={x.tabs} aria-label={t('推荐记录','Referral records')}>{[['team',t('三级团队','Team')],['rewards',t('奖励明细','Rewards')],['rules',t('奖励规则','Rules')]].map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setPage(1)}}>{label}</button>)}</nav>
    {tab==='team'&&<><div className={x.metrics}>{summary.data?.levels.map(r=><div key={r.level}><small>{t('第','Level ')}{r.level}{t('级','')}</small><b><Users size={14}/> {r.count}</b></div>)}</div><label>{t('层级','Level')} <select value={level} onChange={e=>{setLevel(e.target.value);setPage(1)}}>{['all','1','2','3'].map(v=><option key={v} value={v}>{v==='all'?t('全部','All'):v}</option>)}</select></label></>}
    {(tab==='team'||tab==='rewards')&&(list.error?<StateBlock tone="error" title={t('加载失败','Unable to load')} body={list.error.message} retry={list.refetch} retryLabel={t('重试','Retry')}/>:!list.data?<Skeleton rows={3}/>:<>{list.data.items.length===0?<StateBlock title={t('暂无记录','No records yet')}/>:<div className={x.scroll}><table className={x.table}><thead><tr><th>{tab==='team'?t('成员','Member'):t('金额','Amount')}</th><th>{t('层级','Level')}</th><th>{tab==='team'?t('注册绑定日期','Bound on'):t('状态','State')}</th></tr></thead><tbody>{tab==='team'?members.data?.items.map((r,i)=><tr key={`${r.memberLabel}:${i}`}><td>{r.memberLabel}…</td><td>{r.level}</td><td>{fmtDate(r.boundAt,locale)}</td></tr>):awards.data?.items.map(r=><tr key={r.id}><td>{fmtAtomic(r.amountAtomic,r.decimals,r.currency)}<small style={{display:'block'}}>v{r.settingsVersion} · {fmtDate(r.occurredAt,locale)}</small></td><td>{r.level}</td><td>{({candidate:t('待计算','Candidate'),pending_review:t('待审','Pending'),rejected:t('已拒绝','Rejected'),revoked:t('已撤销','Revoked')} as Record<string,string>)[r.state]??r.state}</td></tr>)}</tbody></table></div>}<div className={x.pager}><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>{t('上一页','Previous')}</button><small>{page} / {Math.max(1,Math.ceil(list.data.total/20))}</small><button disabled={page*20>=list.data.total} onClick={()=>setPage(p=>p+1)}>{t('下一页','Next')}</button></div></>)}
    {tab==='rules'&&summary.data&&<section className={`${x.card} ${x.rules}`}><p>{t('配置版本','Configured version')} {summary.data.rules.version}</p><p className={x.status}>{t('规则生效时间','Rule effective dates')}<br/>{t('手续费','Fees')}: {fmtDate(summary.data.rules.effectiveAt.fee,locale)}<br/>{t('持仓','Holdings')}: {fmtDate(summary.data.rules.effectiveAt.holding,locale)}<br/>{t('团队','Team')}: {fmtDate(summary.data.rules.effectiveAt.team,locale)}</p><p>{t('手续费分成（1 / 2 / 3 级）','Fee sharing (levels 1 / 2 / 3)')}<br/>{summary.data.rules.feeRatesBps.map(b=>`${b/100}%`).join(' / ')}</p><p>{t('合格持仓年化（1 / 2 / 3 级）','Eligible holdings annual rates (levels 1 / 2 / 3)')}<br/>{summary.data.rules.holdingRatesBps.map(b=>`${b/100}%`).join(' / ')}</p><p>{t('团队手续费累进阶梯','Progressive team fee tiers')}<br/>{summary.data.rules.teamTiers.map((r,i)=><span key={i} style={{display:'block'}}>{fmtAtomic(r.fromAtomic,6,'USDT')} – {r.toAtomic?fmtAtomic(r.toAtomic,6,'USDT'):t('以上','and above')}: {r.rateBps/100}%</span>)}</p><p className={x.status}>{t('奖励功能筹备中；持仓返利与团队结算尚未上线。配置比例不代表已产生收益。','Rewards are being prepared. Holding rebates and team settlement are not live. Configured rates do not represent earned returns.')}</p></section>}
    <div className={x.actions}><button onClick={()=>setTab('legacy')}>{t('历史邮件邀请与奖励','Legacy email invitations & rewards')}</button></div>
  </MaisonPage>
}
