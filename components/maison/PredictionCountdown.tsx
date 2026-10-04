'use client'
import {useEffect,useState} from 'react'
import {Clock3} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import {predictionCountdown} from '@/lib/prediction-availability'
import {predictionAvailabilityText} from '@/lib/prediction-availability-copy'
import styles from './prediction-availability.module.css'

export function PredictionCountdown({endAt,closed=false}:{endAt:string|null|undefined;closed?:boolean}) {
  const {locale}=useI18n()
  const [now,setNow]=useState<number|null>(null)
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer)},[endAt])
  const remaining=now===null?null:predictionCountdown(endAt,now)
  if(!remaining)return null
  const tr=(key:Parameters<typeof predictionAvailabilityText>[1])=>predictionAvailabilityText(locale,key)
  const clock=[remaining.hours,remaining.minutes,remaining.seconds].map(n=>n.toLocaleString(locale,{minimumIntegerDigits:2,useGrouping:false})).join(':')
  return <div className={styles.countdown}><Clock3 size={14} aria-hidden="true"/>{closed?tr('Closed'):remaining.reached?tr('Scheduled end reached'):<><span>{tr('Ends in')}</span><time dateTime={endAt??undefined}>{remaining.days>0?`${remaining.days.toLocaleString(locale)} ${tr('Days')} `:''}{clock}</time></>}</div>
}
