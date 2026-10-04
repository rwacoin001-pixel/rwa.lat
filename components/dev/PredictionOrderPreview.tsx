'use client'
import { useState } from 'react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { useI18n } from '@/lib/i18n'
import { MaisonPage, Logo, maison as s } from '@/components/maison/primitives'
import { PredictionSheet } from '@/components/maison/PredictionSheet'
import { PredictionBetForm } from '@/components/maison/PredictionBetForm'
import { predictionTicketCopy } from '@/lib/prediction-ticket-copy'
import { estimatePredictionBet } from '@/lib/prediction-bet-estimate'
import { addPredictionStake } from '@/lib/prediction-ticket-state'
import { toAtomic } from '@/lib/money'
import { marketCopy } from '@/lib/maison-market-copy'
import ui from '@/components/maison/prediction-experience.module.css'

/** Local-only, explicit fixtures: no account token, network order or balance write. */
export default function PredictionOrderPreview() {
  const { theme, toggleTheme } = useRwaTheme(), { locale } = useI18n()
  const [open,setOpen]=useState(true),[stake,setStake]=useState('10'),[side,setSide]=useState(0),[risk,setRisk]=useState(false)
  const [mode,setMode]=useState<'bet'|'deposit'|'reload'|'expired'|'capacity'>('bet'),[feedback,setFeedback]=useState('')
  const blocked=mode==='expired'||mode==='capacity'
  const estimate=estimatePredictionBet({stakeAtomic:toAtomic(stake,6),decimals:6,price:blocked?null:side===1?.65:.35,placeFeeRate:.03,payoutFeeRate:.01})
  const labels=predictionTicketCopy[locale]
  return <main className="rwa-shell"><div className="rwa-mobile" data-theme={theme} data-screen="prediction-detail">
    <MaisonPage page="prediction-preview">
      <h1 className={s.titleL}>下单卡片预览</h1><p className={s.foot}>隔离示例 · 不会下单或修改余额</p>
      <div className={s.chips}><button className={s.chip} onClick={toggleTheme}>切换主题</button>{(['bet','deposit','reload','expired','capacity'] as const).map((state,index)=><button key={state} className={s.chip} aria-pressed={mode===state} onClick={()=>{setMode(state);setOpen(true);setFeedback('')}}>{['有余额','无余额','余额失败','报价过期','金额过大'][index]}</button>)}<button className={s.chip} onClick={()=>setOpen(true)}>打开卡片</button></div>
      <div className={ui.row}><h2>巴西总统选举</h2><p className={s.foot}>路易斯·伊纳西奥·卢拉·达席尔瓦</p><div className={s.outcome}><button data-side="yes">是 · 35%</button><button data-side="no">否 · 65%</button></div></div>
      <PredictionSheet open={open} onClose={()=>setOpen(false)} title={labels.buy} compact>
        <div className={`${ui.identity} ${ui.ticketIdentity}`}><Logo name="Lula"/><div><small>巴西总统选举</small><b>路易斯·伊纳西奥·卢拉·达席尔瓦</b></div></div>
        <PredictionBetForm stake={stake} onStake={setStake} onAdd={amount=>setStake(addPredictionStake(stake,amount))} outcome={side} onOutcome={setSide}
          outcomes={[{label:marketCopy[locale].review.yes,probability:'35%',disabled:false},{label:marketCopy[locale].review.no,probability:'65%',disabled:false}]}
          balance={mode==='deposit'?'0.00 USDT':'1,000.00 USDT'} walletAction={mode==='deposit'?'deposit':mode==='reload'?'reload':'bet'}
          price={blocked?'—':`${side?65:35}¢`} shares={estimate.shares?.toFixed(2)??'—'} fees={`${(Number(stake||0)*.03).toFixed(2)} USDT + ${estimate.payoutFee?.toFixed(2)??'—'} USDT`} netPayout={estimate.netPayout===null?'—':`≈ ${estimate.netPayout.toFixed(2)} USDT`} updatedAt="12:00"
          quoteReason={mode==='expired'?'expired':mode==='capacity'?'no_liquidity':null} amountTooLarge={mode==='capacity'} smallerStake={mode==='capacity'?'5':null}
          refreshing={false} pending={false} risk={risk} onRisk={setRisk} ready={risk&&!blocked&&Boolean(toAtomic(stake,6)&&Number(stake)>0)}
          onRefresh={()=>{setMode('bet');setFeedback('示例报价已刷新')}} onLower={()=>{setStake('5');setMode('bet')}} onReload={()=>setMode('bet')}
          onDeposit={()=>setFeedback('示例：真实卡片会打开充值页面，保留金额')} onSubmit={()=>setFeedback('隔离预览：未提交真实投注')} serverError={feedback}/>
      </PredictionSheet>
    </MaisonPage>
  </div></main>
}
