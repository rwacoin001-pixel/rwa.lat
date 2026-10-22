'use client'
import { useQuery } from '@/lib/api/_query'
import { referralTeamRewards, type ReferralSummary } from '@/lib/api/referral'
import { fmtAtomic, fmtDateTime } from './format'
import { StateBlock, Skeleton } from './primitives'
import c from './referral-card.module.css'

type Tier = ReferralSummary['rules']['teamTiers'][number]

/** Monthly team settlement: the progressive tiers as a scale, then one receipt per settled month. */
export function ReferralTeamRewards({ locale, tiers }: { locale: string; tiers: Tier[] }) {
  const zh=locale.startsWith('zh'), t=(cn:string,en:string)=>zh?cn:en
  const result=useQuery('referral:v2:team-settlements',referralTeamRewards,{staleTime:30_000})
  const names={pending:t('待审核','Pending review'),approved:t('待发放','Approved'),paid:t('已到账','Credited')}
  const pct=(bps:number)=>`${Number((bps/100).toFixed(2))}%`
  const usdt=(atomic:string)=>fmtAtomic(atomic,6,'',0).trim()
  const range=(tier:Tier)=>tier.toAtomic?`${usdt(tier.fromAtomic)}–${usdt(tier.toAtomic)}`:t(`${usdt(tier.fromAtomic)} 以上`,`${usdt(tier.fromAtomic)}+`)
  return <section className={c.panel} aria-labelledby="referral-team-settlement">
    <h2 id="referral-team-settlement" className={c.eyebrow}>{t('团队月结','Monthly team settlement')}<b>{t('分段累进','Progressive')}</b></h2>
    {tiers.length>0&&<>
      <div className={c.scale} aria-hidden="true">{tiers.map((_,i)=><i key={i}/>)}</div>
      <div className={c.scaleLegend}>{tiers.map((tier,i)=><div key={i}><b>{pct(tier.rateBps)}</b><span>{range(tier)} USDT</span></div>)}</div>
    </>}
    {result.error?<StateBlock tone="error" title={t('月结记录加载失败','Unable to load settlements')} body={result.error.message} retry={result.refetch} retryLabel={t('重试','Retry')}/>:!result.data?<Skeleton rows={2}/>:<>
      <p className={c.note}>{result.data.activatedAt
        ?<>{t('每段金额按该段比例计算后合计。','Each segment earns its own rate, then the amounts are added.')} {t('自 ','Accrues from ')}<b>{fmtDateTime(result.data.activatedAt,locale)}</b>{t(' 起累计，不追补历史；月末生成，审核并发放后自动进入可用余额。',', with no historical backfill. Generated after month end and credited to available balance automatically once reviewed and funded.')}</>
        :t('团队月结尚未启用。','Team settlement has not been activated.')}</p>
      {!result.data.items.length?<p className={c.emptyLine}>{t('首个月结将在本月结束后生成','The first settlement is generated after this month ends')}</p>
        :<ul className={c.receipts}>{result.data.items.map(row=><li key={row.month}>
          <b>{row.month} · {fmtAtomic(row.amountAtomic,6,'USDT')}</b>
          <em data-status={row.status}>{names[row.status]}</em>
          <span>{t('净合格手续费','Net eligible fees')} {fmtAtomic(row.baseAtomic,6,'USDT')}</span>
        </li>)}</ul>}
    </>}
  </section>
}
