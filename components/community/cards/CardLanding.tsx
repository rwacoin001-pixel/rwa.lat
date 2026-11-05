'use client'

import { brandText } from '@/lib/brand/build-brand'

/**
 * The public page behind a shared card link (/share/<token>, 2026-11-01). The card exactly as posted (hidden fields stay
 * hidden), the author, and two ways in: join (through the author's invite link when there is one) and the Android app.
 * The risk line travels with the card. Readable without an account.
 */
import { ArrowRight } from 'lucide-react'
import controls from '@/components/ui/controls.module.css'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { ANDROID_APP } from '@/lib/android-app'
import type { PostCard } from '@/lib/community-cards'
import { ResultCard, type Author } from './ResultCard'
import s from './card-landing.module.css'

type Copy = { kicker: string; title: (name: string) => string; join: string; app: string; note: string }
const copy: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': { kicker: brandText('A-REIT 社区'), title: (name) => `${name} 分享了一张卡片`, join: brandText('加入 A-REIT'), app: '下载安卓 App', note: brandText('卡片上的数字来自作者的 A-REIT 账户，发出后不会改变。') },
  en: { kicker: brandText('A-REIT Community'), title: (name) => `${name} shared a card`, join: brandText('Join A-REIT'), app: 'Get the Android app', note: brandText('The figures come from the author’s A-REIT account and do not change after posting.') },
}

export function CardLanding({ card, author, referralCode }: { card: PostCard; author: Author; referralCode: string | null }) {
  const { locale } = useI18n()
  const k = copy[locale] ?? copy.en!
  const join = referralCode ? `/r/${encodeURIComponent(referralCode)}?next=${encodeURIComponent('/register')}` : '/register'
  return <main className={s.page}>
    <header className={s.head}><p>{k.kicker}</p><h1 dir="auto">{k.title(author.displayName)}</h1></header>
    <ResultCard card={card} author={author} />
    <p className={s.note}>{k.note}</p>
    <div className={s.keys}>
      <a className={`${controls.primary} ${s.join}`} href={join}><span>{k.join}</span><i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} strokeWidth={1.7} /></i></a>
      {ANDROID_APP.url && <a className={s.app} href={ANDROID_APP.url} download>{k.app}</a>}
    </div>
  </main>
}
