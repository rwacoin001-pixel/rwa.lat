'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { getCommunityFeed, getCommunityTopics, type CommunityPost } from '@/lib/api/community'
import { useQuery } from '@/lib/api/_query'
import { useI18n, type AppLocale } from '@/lib/i18n'
import styles from './HomeSocialFeed.module.css'

type Labels = { all: string; loading: string; retry: string; end: string; emptyTitle: string; emptyBody: string }
type Props = { onOpen: (post: CommunityPost) => void; labels: Labels }

const topicNames: Record<AppLocale, Record<string, string>> = {
  en: { 'ai-compute': 'AI Compute', rwa: 'Real Assets', market: 'Markets', newbie: 'Getting started', security: 'Security', community: 'Community', lounge: 'Lounge' },
  'zh-CN': { 'ai-compute': 'AI 算力', rwa: '真实资产', market: '行情', newbie: '新手', security: '安全', community: '社区', lounge: '闲聊' },
  hi: { 'ai-compute': 'AI कंप्यूट', rwa: 'वास्तविक संपत्ति', market: 'बाज़ार', newbie: 'शुरुआत', security: 'सुरक्षा', community: 'समुदाय', lounge: 'चर्चा' },
  es: { 'ai-compute': 'Cómputo IA', rwa: 'Activos reales', market: 'Mercados', newbie: 'Primeros pasos', security: 'Seguridad', community: 'Comunidad', lounge: 'Charlas' },
  ar: { 'ai-compute': 'حوسبة الذكاء', rwa: 'أصول حقيقية', market: 'الأسواق', newbie: 'للمبتدئين', security: 'الأمان', community: 'المجتمع', lounge: 'نقاش' },
  fr: { 'ai-compute': 'Calcul IA', rwa: 'Actifs réels', market: 'Marchés', newbie: 'Débuter', security: 'Sécurité', community: 'Communauté', lounge: 'Discussion' },
  pt: { 'ai-compute': 'Computação IA', rwa: 'Ativos reais', market: 'Mercados', newbie: 'Começar', security: 'Segurança', community: 'Comunidade', lounge: 'Conversa' },
}

const PAGE_SIZE = 6
const conceptArt = [
  { match: 'Solar Income 2027 distribution for August', src: '/media/home/feed-solar-concept.webp' },
  { match: 'H100 rental rates held steady', src: '/media/home/feed-compute-concept.webp' },
  { match: 'Note on tokenized T-bills', src: '/media/home/feed-treasury-concept.webp' },
]

export function HomeSocialFeed({ onOpen, labels }: Props) {
  const { locale } = useI18n()
  const topics = useQuery('community:topics:home', getCommunityTopics, { staleTime: 300_000 })
  const [topic, setTopic] = useState<string | null>(null)
  const [items, setItems] = useState<CommunityPost[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const generation = useRef(0)
  const busy = useRef(false)
  const dateFormatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })

  const load = useCallback(async (next: string | null, append: boolean, requestGeneration: number) => {
    if (busy.current) return
    busy.current = true
    if (append) setLoadingMore(true)
    const result = await getCommunityFeed(PAGE_SIZE, next, topic ?? undefined)
    if (requestGeneration === generation.current) {
      if (result.ok) {
        setItems(previous => append ? [...previous, ...result.data.items] : result.data.items)
        setCursor(result.data.nextCursor ?? null)
        setState('ready')
        setMoreError(false)
      } else if (append) setMoreError(true)
      else setState('error')
      busy.current = false
      setLoadingMore(false)
    }
  }, [topic])

  useEffect(() => {
    const current = ++generation.current
    busy.current = false
    setItems([])
    setCursor(null)
    setState('loading')
    setMoreError(false)
    void load(null, false, current)
    return () => { generation.current++ }
  }, [load])

  useEffect(() => {
    const target = sentinel.current
    if (!target || state !== 'ready' || !cursor || moreError) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void load(cursor, true, generation.current)
    }, { rootMargin: '320px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [cursor, load, moreError, state])

  return <div className={styles.root}>
    <div className={styles.tabs} role="tablist" aria-label={locale === 'zh-CN' ? '社区主题' : 'Community topics'}>
      <button type="button" role="tab" aria-selected={!topic} className={!topic ? styles.active : ''} onClick={() => setTopic(null)}>{labels.all}</button>
      {topics.data?.items.map(item => <button type="button" role="tab" aria-selected={topic === item.slug} className={topic === item.slug ? styles.active : ''} key={item.id} onClick={() => setTopic(item.slug)}>{topicNames[locale][item.slug] ?? item.title}</button>)}
    </div>
    {state === 'loading' && <div className={styles.loading} aria-busy="true"><span /><span /><span /></div>}
    {state === 'error' && <button type="button" className={styles.message} onClick={() => { generation.current++; setState('loading'); void load(null, false, generation.current) }}>{labels.retry}</button>}
    {state === 'ready' && !items.length && <div className={styles.message}><strong>{labels.emptyTitle}</strong><p>{labels.emptyBody}</p></div>}
    {state === 'ready' && items.map(post => <button type="button" className={styles.post} key={post.id} onClick={() => onOpen(post)}>
      <span className={styles.avatar} aria-hidden="true">{post.author?.avatarUrl ? <img src={post.author.avatarUrl} alt="" loading="lazy" /> : (post.author?.displayName ?? '·').slice(0, 1).toUpperCase()}</span>
      <span className={styles.postMain}>
        <span className={styles.meta}><strong>{post.author?.displayName ?? '—'}</strong>{post.author?.handle && <><span>@{post.author.handle}</span><span>·</span></>}<time dateTime={post.publishedAt}>{dateFormatter.format(new Date(post.publishedAt))}</time><ArrowUpRight size={15} aria-hidden="true" /></span>
        <span className={styles.body}>{post.body}</span>
        {post.images?.[0] ? <span className={styles.image}><img src={post.images[0]} alt="" loading="lazy" /></span> : (() => {
          const illustration = conceptArt.find(item => post.body.includes(item.match))
          return illustration && <span className={styles.image}><Image src={illustration.src} alt="" width={900} height={560} sizes="(max-width: 430px) calc(100vw - 94px), 336px" /><span className={styles.imageCaption}>{locale === 'zh-CN' ? '概念配图' : 'Concept illustration'}</span></span>
        })()}
        <span className={styles.actions} aria-hidden="true"><span><MessageCircle size={16} />{post.commentCount}</span><span><Repeat2 size={16} /></span><span><Heart size={16} />{post.likeCount}</span></span>
      </span>
    </button>)}
    {state === 'ready' && <div ref={sentinel} className={styles.sentinel}>
      {loadingMore ? <span className={styles.spinner} aria-label={labels.loading} /> : moreError ? <button type="button" onClick={() => void load(cursor, true, generation.current)}>{labels.retry}</button> : cursor === null ? <span>{labels.end}</span> : null}
    </div>}
  </div>
}
