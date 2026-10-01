'use client'
import {ArrowRight,Info} from 'lucide-react'
import {useRef,useState} from 'react'
import {useContentTranslation} from '@/lib/use-content-translation'
import {useI18n} from '@/lib/i18n'
import {PredictionSheet} from './PredictionSheet'
import {maison as s} from './primitives'
import ui from './prediction-experience.module.css'

const TEXT={
  'How to play':'玩法介绍','Choose an event and a side':'选择事件与方向',
  'Read the settlement rules, then choose a candidate or date and buy Yes or No. Each option has its own market.':'先看结算规则，再选择候选人或日期，以及是或否。每个选项对应独立盘口。',
  'Review your order':'核对金额与收益',
  'Enter your USDT amount. Check the actual execution price, estimated shares, fees and net winning return. Probability is not a guaranteed execution price.':'输入 USDT 金额，核对实际成交价、预计份数、费用和中奖净到账。市场概率不等于保证成交价。',
  'Wait for settlement':'等待结果与结算',
  'Each winning share pays 1 USDT before payout fees. Losing shares pay 0. Net winning return includes your principal. Early selling is available only when the platform supports it.':'中奖份额每份按 1 USDT 计算，再扣派彩费；未中奖份额到账为 0。中奖净到账包含本金。提前卖出以平台实际支持为准。',
  'Next':'下一页','Got it':'我知道了','Previous':'上一页','Illustration only · actual prices and fees prevail':'示意说明 · 以实际报价与费率为准',
  'Yes':'是','No':'否','Shares':'份数','Example':'示例','Before fees':'未扣费用','Winning share':'中奖份额','Losing share':'未中奖份额',
} as const
export function PredictionHowTo() {
  const {locale}=useI18n(),[open,setOpen]=useState(false),[step,setStep]=useState(0),start=useRef<{x:number;y:number}|null>(null)
  const translated=useContentTranslation(Object.keys(TEXT))
  const tr=(text:keyof typeof TEXT)=>{const value=translated(text);return value===text&&locale.startsWith('zh')?TEXT[text]:value}
  const titles=['Choose an event and a side','Review your order','Wait for settlement'] as const
  const bodies=['Read the settlement rules, then choose a candidate or date and buy Yes or No. Each option has its own market.','Enter your USDT amount. Check the actual execution price, estimated shares, fees and net winning return. Probability is not a guaranteed execution price.','Each winning share pays 1 USDT before payout fees. Losing shares pay 0. Net winning return includes your principal. Early selling is available only when the platform supports it.'] as const
  return <><button type="button" className={ui.learnButton} onClick={()=>{setStep(0);setOpen(true)}}><Info size={15}/>{tr('How to play')}</button>
    <PredictionSheet open={open} onClose={()=>setOpen(false)} title={tr('How to play')}>
      <div className={ui.tutorial} onTouchStart={e=>{start.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}} onTouchEnd={e=>{if(start.current){const dx=e.changedTouches[0].clientX-start.current.x,dy=e.changedTouches[0].clientY-start.current.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)setStep(v=>Math.max(0,Math.min(2,v+(dx<0?1:-1))))}start.current=null}}>
        <p className={s.kicker}>0{step+1} / 03 · {tr('Example')}</p>
        <div className={ui.tutorialArt} aria-hidden="true" key={step}><div className={ui.floatingCard}>
          {step===0?<><span>50%</span><b>{tr('Choose an event and a side')}</b><div className={ui.artChoices}><i>{tr('Yes')}</i><i>{tr('No')}</i></div></>:
          step===1?<><span>100 USDT ÷ 0.50</span><b>200 {tr('Shares')}</b><span>{tr('Before fees')}</span></>:
          <><span>{tr('Winning share')}</span><b>1 USDT</b><span>{tr('Losing share')} · 0 USDT</span></>}
        </div></div>
        <h2 className={s.titleL} style={{fontSize:26}}>{tr(titles[step])}</h2><p className={s.prose}>{tr(bodies[step])}</p>
        <div className={ui.dots}>{titles.map((title,i)=><button key={title} type="button" aria-label={tr(title)} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}/>)}</div>
        <button type="button" className={s.cta} style={{width:'100%'}} onClick={()=>step===2?setOpen(false):setStep(v=>v+1)}><span>{tr(step===2?'Got it':'Next')}</span><span className={s.ctaIcon}><ArrowRight size={17}/></span></button>
        {step>0&&<button type="button" className={s.link} style={{marginTop:16}} onClick={()=>setStep(v=>v-1)}>{tr('Previous')}</button>}
        <p className={s.foot}>{tr('Illustration only · actual prices and fees prevail')}</p>
      </div>
    </PredictionSheet>
  </>
}
