'use client'
import { useQuery } from '@/lib/api/_query'
import { referralTeamRewards } from '@/lib/api/referral'
import { fmtAtomic, fmtDateTime } from './format'
import { StateBlock, Skeleton } from './primitives'
import x from './referral.module.css'

export function ReferralTeamRewards({ locale }: { locale: string }) {
  const zh=locale.startsWith('zh'), t=(cn:string,en:string)=>zh?cn:en
  const result=useQuery('referral:v2:team-settlements',referralTeamRewards,{staleTime:30_000})
  const names={pending:t('待审核','Pending review'),approved:t('待发放','Approved'),paid:t('已到账','Paid')}
  return <section className={x.team} aria-label={t('团队月结','Monthly team settlement')}>
    <div className={x.cardHead}><h2>{t('团队月结','Monthly team settlement')}</h2></div>
    {result.error?<StateBlock tone="error" title={t('月结记录加载失败','Unable to load settlements')} body={result.error.message} retry={result.refetch} retryLabel={t('重试','Retry')}/>:!result.data?<Skeleton rows={2}/>:<>
      <p className={x.hint}>{result.data.activatedAt?t(`从 ${fmtDateTime(result.data.activatedAt,locale)} 起累计；不追补历史。`,`Accrues from ${fmtDateTime(result.data.activatedAt,locale)}. No historical backfill.`):t('团队月结尚未启用。','Team settlement has not been activated.')}</p>
      <p className={x.hint}>{t('自然月结束后生成，审核并完成资金发放后直接进入可用余额，无需再次领取。','Generated after month end. Approved and funded rewards credit available balance directly; no separate claim is needed.')}</p>
      {!result.data.items.length?<p className={x.empty}>{t('暂无月结记录','No monthly settlements yet')}</p>:<ul className={x.list}>{result.data.items.map(row=><li className={x.row} key={row.month}><div><b>{row.month} · {fmtAtomic(row.amountAtomic,6,'USDT')}</b><span>{t('净合格手续费','Net eligible fees')} {fmtAtomic(row.baseAtomic,6,'USDT')}</span></div><span className={x.state}>{names[row.status]}</span></li>)}</ul>}
    </>}
  </section>
}
