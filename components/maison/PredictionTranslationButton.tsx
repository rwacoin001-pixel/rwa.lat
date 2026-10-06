'use client'
import {Languages} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import {communityExperienceCopy} from '@/lib/community-experience-copy'
import type {useContentTranslation} from '@/lib/use-content-translation'
import {maison as s} from './primitives'
export function PredictionTranslationButton({translation,original,onOriginal,sources}:{translation:ReturnType<typeof useContentTranslation>;original:boolean;onOriginal:(value:boolean)=>void;sources:string[]}) {
  const {locale}=useI18n(),copy=communityExperienceCopy[locale]
  if(locale==='en')return null
  const complete=sources.filter(Boolean).every(translation.hasTranslation)
  const busy=sources.some(translation.isPending)
  return <button type="button" className={s.predTranslate} onClick={()=>{if(!complete){onOriginal(false);translation.retry(sources)}else onOriginal(!original)}} disabled={busy} aria-busy={busy}>
    <Languages size={11} strokeWidth={2.2} aria-hidden="true"/>{busy?copy.translating:!complete&&translation.error?copy.retry:complete&&!original?copy.original:copy.translate}
  </button>
}
