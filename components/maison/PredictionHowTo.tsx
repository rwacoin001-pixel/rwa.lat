'use client'
import {Info} from 'lucide-react'
import {useEffect,useId,useRef,useState} from 'react'
import {useContentTranslation} from '@/lib/use-content-translation'
import {useI18n} from '@/lib/i18n'
import {PredictionSheet} from './PredictionSheet'
import {maison as s} from './primitives'
import ui from './prediction-experience.module.css'

const TEXT={
  'How to play':'玩法介绍','Choose an event and a side':'选择事件与方向',
  'Read the rules. Choose Yes or No.':'先看规则，再选“是”或“否”。',
  'Review your order':'核对金额与收益',
  'Enter an amount. Check shares, fees and net return.':'输入金额，核对份数、费用与净到账。',
  'Wait for settlement':'等待结果与结算',
  'Winning shares pay 1 USDT each, less payout fees. Losing shares pay 0. Net return includes principal.':'中奖每份 1 USDT，扣派彩费；未中奖为 0。净到账含本金。',
  'Got it':'我知道了','Swipe to explore':'滑动查看',
  'Yes':'是','No':'否','Shares':'份数','Example':'示例','Before fees':'未扣费用','Winning share':'中奖份额','Losing share':'未中奖份额',
} as const
function GuideArt({step,tr}:{step:number;tr:(text:keyof typeof TEXT)=>string}) {
  const id=useId().replace(/:/g,'')
  return <svg viewBox="0 0 360 228" className={ui.guideImage} aria-hidden="true">
    <defs><radialGradient id={id}><stop stopColor="var(--m-accent)" stopOpacity=".2"/><stop offset="1" stopColor="var(--m-accent)" stopOpacity="0"/></radialGradient></defs>
    <ellipse cx="180" cy="122" rx="173" ry="108" fill={`url(#${id})`}/><circle cx="180" cy="108" r="100" fill="none" stroke="var(--m-accent)" strokeOpacity=".13" strokeDasharray="2 8"/>
    <g transform={`rotate(${step===1?4:-6} 180 120)`}>
      <rect x="58" y="43" width="244" height="154" rx="22" fill="var(--m-glass-deep)" stroke="var(--m-line)"/>
      {step===0?<><circle cx="92" cy="74" r="12" fill="var(--m-accent)" fillOpacity=".25"/><path d="M119 70h108m-108 10h65" stroke="var(--m-ink)" strokeOpacity=".22" strokeWidth="4" strokeLinecap="round"/><path d="M81 125l35-8 28 5 33-24 35 8 35-22 34 7" fill="none" stroke="var(--m-accent)" strokeWidth="2.5"/><circle cx="281" cy="91" r="4" fill="var(--m-accent)"/><rect x="80" y="147" width="96" height="32" rx="12" fill="var(--m-up)" fillOpacity=".12"/><rect x="186" y="147" width="96" height="32" rx="12" fill="var(--m-down)" fillOpacity=".1"/><text x="128" y="168" textAnchor="middle" fill="var(--m-up)" fontSize="13">{tr('Yes')}</text><text x="234" y="168" textAnchor="middle" fill="var(--m-down)" fontSize="13">{tr('No')}</text></>:
      step===1?<><text x="180" y="80" textAnchor="middle" fill="var(--m-muted)" fontSize="12">{tr('Example')} · {tr('Before fees')}</text><text x="180" y="122" textAnchor="middle" fill="var(--m-ink)" fontSize="29">100 USDT</text><path d="M89 140h182" stroke="var(--m-line)"/><text x="180" y="168" textAnchor="middle" fill="var(--m-accent)" fontSize="17">÷ 0.50 = 200 {tr('Shares')}</text></>:
      <><circle cx="91" cy="80" r="14" fill="var(--m-up)" fillOpacity=".12"/><path d="m84 80 5 5 10-12" fill="none" stroke="var(--m-up)" strokeWidth="2"/><text x="115" y="84" fill="var(--m-muted)" fontSize="12">{tr('Winning share')}</text><text x="83" y="132" fill="var(--m-accent)" fontSize="30">1 USDT</text><path d="M83 145h193" stroke="var(--m-line)"/><text x="180" y="172" textAnchor="middle" fill="var(--m-muted)" fontSize="13">{tr('Losing share')} · 0 USDT</text></>}
    </g>
  </svg>
}
export function PredictionHowTo({open:controlledOpen,onOpenChange,hideTrigger=false}:{open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean}={}) {
  const {locale}=useI18n(),[localOpen,setLocalOpen]=useState(false),[step,setStep]=useState(0),start=useRef<{x:number;y:number}|null>(null)
  const open=controlledOpen??localOpen
  const setOpen=(value:boolean)=>{setLocalOpen(value);onOpenChange?.(value);if(value)setStep(0)}
  useEffect(()=>{if(open)setStep(0)},[open])
  const translated=useContentTranslation(Object.keys(TEXT))
  const tr=(text:keyof typeof TEXT)=>{const value=translated(text);return value===text&&locale.startsWith('zh')?TEXT[text]:value}
  const titles=['Choose an event and a side','Review your order','Wait for settlement'] as const
  const bodies=['Read the rules. Choose Yes or No.','Enter an amount. Check shares, fees and net return.','Winning shares pay 1 USDT each, less payout fees. Losing shares pay 0. Net return includes principal.'] as const
  return <>{!hideTrigger&&<button type="button" className={ui.learnButton} onClick={()=>{setStep(0);setOpen(true)}}><Info size={15}/>{tr('How to play')}</button>}
    <PredictionSheet open={open} onClose={()=>setOpen(false)} title={tr('How to play')}>
      <div className={ui.tutorial} onTouchStart={e=>{start.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}} onTouchEnd={e=>{if(start.current){const dx=e.changedTouches[0].clientX-start.current.x,dy=e.changedTouches[0].clientY-start.current.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)setStep(v=>Math.max(0,Math.min(2,v+(dx<0?1:-1))))}start.current=null}}>
        <div className={ui.guideScene} key={step}><GuideArt step={step} tr={tr}/></div>
        <div className={ui.guideCopy} aria-live="polite"><span className={s.kicker}>0{step+1} / 03</span><h2 className={s.titleL}>{tr(titles[step])}</h2><p>{tr(bodies[step])}</p></div>
        <div className={ui.dots}>{titles.map((title,i)=><button key={title} type="button" aria-label={tr(title)} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}><i/></button>)}</div>
        {step===2?<button type="button" className={s.cta} style={{width:'100%'}} onClick={()=>setOpen(false)}>{tr('Got it')}</button>:<p className={ui.swipeHint}>{tr('Swipe to explore')} ↔</p>}
      </div>
    </PredictionSheet>
  </>
}
