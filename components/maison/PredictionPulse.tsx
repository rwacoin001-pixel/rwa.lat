'use client'
import {useEffect,useState} from 'react'
import type {PolymarketFeedMarket} from '@/lib/api/polymarket-feed'
import {useI18n,type AppLocale} from '@/lib/i18n'
import {Figure} from './motion'
import {maison as s} from './primitives'

/**
 * Feed card for the current BTC 5-minute up/down round. The upstream title ("Bitcoin Up or Down - October 13,
 * 2:00PM-2:05PM ET") does not translate well and a 24h volume is meaningless for a 5-minute round, so the card
 * states what it is, the round in local time with a countdown, and the two sides with their probabilities.
 */
const COPY:Record<AppLocale,{title:string;round:string;left:string;ended:string;up:string;down:string}>={
  en:{title:'Bitcoin · 5-minute up or down',round:'Round {a}–{b}',left:'{t} left',ended:'Round ended',up:'Up',down:'Down'},
  'zh-CN':{title:'比特币 · 5 分钟涨跌',round:'本轮 {a}–{b}',left:'剩余 {t}',ended:'本轮已结束',up:'涨',down:'跌'},
  hi:{title:'बिटकॉइन · 5 मिनट ऊपर या नीचे',round:'राउंड {a}–{b}',left:'{t} शेष',ended:'राउंड समाप्त',up:'ऊपर',down:'नीचे'},
  es:{title:'Bitcoin · sube o baja en 5 minutos',round:'Ronda {a}–{b}',left:'Quedan {t}',ended:'Ronda terminada',up:'Sube',down:'Baja'},
  ar:{title:'بيتكوين · صعود أو هبوط خلال 5 دقائق',round:'الجولة {a}–{b}',left:'متبقٍ {t}',ended:'انتهت الجولة',up:'صعود',down:'هبوط'},
  fr:{title:'Bitcoin · hausse ou baisse en 5 minutes',round:'Manche {a}–{b}',left:'{t} restantes',ended:'Manche terminée',up:'Hausse',down:'Baisse'},
  pt:{title:'Bitcoin · sobe ou desce em 5 minutos',round:'Rodada {a}–{b}',left:'Faltam {t}',ended:'Rodada encerrada',up:'Sobe',down:'Desce'},
}
const fill=(template:string,values:Record<string,string>)=>template.replace(/\{(\w+)\}/g,(_,key:string)=>values[key]??'')
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`

export function pulseTitle(locale:AppLocale) { return COPY[locale].title }

/**
 * Whole-percent shares for Up and Down, matched by label so an upstream reorder cannot swap the sides.
 * Rounded together so they always add up to 100 (0.505 / 0.495 must not read 51% / 50%).
 */
export function pulseSides(item:Pick<PolymarketFeedMarket,'outcomes'>):[number,number] {
  const find=(pattern:RegExp)=>item.outcomes.find(outcome=>pattern.test(outcome.label))?.impliedProbability
  const up=find(/^up$/i)??item.outcomes[0]?.impliedProbability??0.5
  const down=find(/^down$/i)??item.outcomes[1]?.impliedProbability??1-up
  const total=up+down
  const upPercent=total>0&&Number.isFinite(total)?Math.round(up/total*100):50
  return [upPercent,100-upPercent]
}

export function PredictionPulse({item}:{item:PolymarketFeedMarket}) {
  const {locale}=useI18n(),copy=COPY[locale]
  const [now,setNow]=useState(()=>Date.now())
  const end=Date.parse(item.window?.end??''),start=Date.parse(item.window?.start??'')
  const timed=Number.isFinite(start)&&Number.isFinite(end)
  useEffect(()=>{if(!timed)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[timed])
  const left=timed?Math.max(0,Math.ceil((end-now)/1000)):null
  const [up,down]=pulseSides(item)
  const time=(ms:number)=>new Date(ms).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})
  return <span className={s.predPulse}>
    {timed&&<span className={s.predPulseRound}>
      <span>{fill(copy.round,{a:time(start),b:time(end)})}</span>
      <b className={s.num} data-ended={left===0||undefined}>{left?fill(copy.left,{t:clock(left)}):copy.ended}</b>
    </span>}
    <span className={s.predPulseSides}>{[up,down].map((percent,side)=><span key={side} data-side={side}>
      <small>{side?copy.down:copy.up}</small>
      <b className={s.num}><Figure value={percent/100} format={{style:'percent',maximumFractionDigits:0}} locale={locale}/></b>
    </span>)}</span>
    <span className={s.predPulseSplit} aria-hidden="true"><i style={{width:`${up}%`}}/></span>
  </span>
}
