'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { getCommunityFeed, getCommunityTopics, type CommunityPost } from '@/lib/api/community'
import { useQuery } from '@/lib/api/_query'
import { useI18n, type AppLocale } from '@/lib/i18n'
import styles from './HomeSocialFeed.module.css'
import {CommunityAvatar,mediaSrc} from '../community-avatar'
import {CommunityText} from '../community-text'

type Labels = { all: string; loading: string; retry: string; end: string; emptyTitle: string; emptyBody: string }
type Props = { onOpen: (post: CommunityPost) => void; onAuthor?: (post: CommunityPost) => void; onPinnedChange?: (pinned: boolean) => void; labels: Labels }

const topicNames: Record<AppLocale, Record<string, string>> = {
  en: { 'ai-compute': 'AI Compute', rwa: 'Real Assets', market: 'Markets', newbie: 'Getting started', security: 'Security', community: 'Community', lounge: 'Lounge' },
  'zh-CN': { 'ai-compute': 'AI 算力', rwa: '真实资产', market: '行情', newbie: '新手', security: '安全', community: '社区', lounge: '闲聊' },
  hi: { 'ai-compute': 'AI कंप्यूट', rwa: 'वास्तविक संपत्ति', market: 'बाज़ार', newbie: 'शुरुआत', security: 'सुरक्षा', community: 'समुदाय', lounge: 'चर्चा' },
  es: { 'ai-compute': 'Cómputo IA', rwa: 'Activos reales', market: 'Mercados', newbie: 'Primeros pasos', security: 'Seguridad', community: 'Comunidad', lounge: 'Charlas' },
  ar: { 'ai-compute': 'حوسبة الذكاء', rwa: 'أصول حقيقية', market: 'الأسواق', newbie: 'للمبتدئين', security: 'الأمان', community: 'المجتمع', lounge: 'نقاش' },
  fr: { 'ai-compute': 'Calcul IA', rwa: 'Actifs réels', market: 'Marchés', newbie: 'Débuter', security: 'Sécurité', community: 'Communauté', lounge: 'Discussion' },
  pt: { 'ai-compute': 'Computação IA', rwa: 'Ativos reais', market: 'Mercados', newbie: 'Começar', security: 'Segurança', community: 'Comunidade', lounge: 'Conversa' },
}

const feedCopy: Record<AppLocale, { topics: string; profile: string; post: string }> = {
  en: { topics: 'Community topics', profile: 'View profile', post: 'Open post' },
  'zh-CN': { topics: '社区主题', profile: '查看作者', post: '查看帖子' },
  hi: { topics: 'समुदाय के विषय', profile: 'प्रोफ़ाइल देखें', post: 'पोस्ट खोलें' },
  es: { topics: 'Temas de comunidad', profile: 'Ver perfil', post: 'Abrir publicación' },
  ar: { topics: 'مواضيع المجتمع', profile: 'عرض الملف الشخصي', post: 'فتح المنشور' },
  fr: { topics: 'Sujets de communauté', profile: 'Voir le profil', post: 'Ouvrir la publication' },
  pt: { topics: 'Tópicos da comunidade', profile: 'Ver perfil', post: 'Abrir publicação' },
}

const PAGE_SIZE = 6
const conceptArt = [
  { match: 'Solar Income 2027 distribution for August', src: '/media/home/feed-solar-concept.webp' },
  { match: 'H100 rental rates held steady', src: '/media/home/feed-compute-concept.webp' },
  { match: 'Note on tokenized T-bills', src: '/media/home/feed-treasury-concept.webp' },
]

export function HomeSocialFeed({ onOpen, onAuthor, onPinnedChange, labels }: Props) {
  const { locale } = useI18n()
  const copy = feedCopy[locale]
  const topics = useQuery('community:topics:home', getCommunityTopics, { staleTime: 300_000 })
  const [topic, setTopic] = useState<string | null>(null)
  const [items, setItems] = useState<CommunityPost[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLSpanElement>(null)
  const tabs = useRef<HTMLDivElement>(null)
  const pinnedChange = useRef(onPinnedChange)
  pinnedChange.current = onPinnedChange
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

  // The probe sits at the tabs' resting place. Once it crosses the topbar's bottom edge the tabs are
  // pinned; once it is back below that edge the tabs are home again. No per-frame scroll maths.
  useEffect(() => {
    const target = probe.current
    if (!target || !tabs.current || !('IntersectionObserver' in window)) return
    const edge = Math.max(0, Math.round(parseFloat(getComputedStyle(tabs.current).top) || 0))
    let pinned = false
    const observer = new IntersectionObserver(([entry]) => {
      const next = !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? edge)
      if (next === pinned) return
      pinned = next
      pinnedChange.current?.(next)
    }, { rootMargin: `-${edge}px 0px 0px 0px` })
    observer.observe(target)
    return () => { observer.disconnect(); if (pinned) pinnedChange.current?.(false) }
  }, [])

  return <div className={styles.root}>
    <span ref={probe} className={styles.probe} aria-hidden="true" />
    <div ref={tabs} className={styles.tabs} role="tablist" aria-label={copy.topics}>
      <button type="button" role="tab" aria-selected={!topic} className={!topic ? styles.active : ''} onClick={() => setTopic(null)}>{labels.all}</button>
      {topics.data?.items.map(item => <button type="button" role="tab" aria-selected={topic === item.slug} className={topic === item.slug ? styles.active : ''} key={item.id} onClick={() => setTopic(item.slug)}>{topicNames[locale][item.slug] ?? item.title}</button>)}
    </div>
    {state === 'loading' && <div className={styles.loading} aria-busy="true"><span /><span /><span /></div>}
    {state === 'error' && <button type="button" className={styles.message} onClick={() => { generation.current++; setState('loading'); void load(null, false, generation.current) }}>{labels.retry}</button>}
    {state === 'ready' && !items.length && <div className={styles.message}><strong>{labels.emptyTitle}</strong><p>{labels.emptyBody}</p></div>}
    {state === 'ready' && items.map(post => <article className={styles.post} key={post.id}>
      <button type="button" className={styles.avatarLink} onClick={() => onAuthor ? onAuthor(post) : onOpen(post)} disabled={Boolean(onAuthor && !post.author?.handle && !post.author?.id)} aria-label={copy.profile + ' · ' + (post.author?.displayName || '—')}><CommunityAvatar avatarUrl={post.author?.avatarUrl} seed={post.author?.avatarSeed ?? post.author?.id} handle={post.author?.handle} size={44} /></button>
      <div className={styles.postMain}>
        <div className={styles.meta}>
          <button type="button" className={styles.authorLink} onClick={() => onAuthor ? onAuthor(post) : onOpen(post)} disabled={Boolean(onAuthor && !post.author?.handle && !post.author?.id)}><strong>{post.author?.displayName || '—'}</strong>{post.author?.handle && <span dir="ltr">@{post.author.handle}</span>}<ArrowUpRight size={13} aria-hidden="true" /></button>
          <span className={styles.postContext}>{(post.location?.city || post.author?.city) && <span>{post.location?.city || post.author?.city}</span>}<time dateTime={post.publishedAt}>{Number.isNaN(Date.parse(post.publishedAt)) ? '—' : dateFormatter.format(new Date(post.publishedAt))}</time></span>
        </div>
        <CommunityText body={post.body} targetId={post.id} className={styles.body} compact onOpen={() => onOpen(post)} />
        {post.images?.[0] ? <span className={styles.image}><img src={mediaSrc(post.images[0]) ?? undefined} alt="" loading="lazy" /></span> : (() => {
          const illustration = conceptArt.find(item => post.body.includes(item.match))
          return illustration && <span className={styles.image}><Image src={illustration.src} alt="" width={900} height={560} sizes="(max-width: 430px) calc(100vw - 94px), 336px" /><span className={styles.imageCaption}>{locale === 'zh-CN' ? '概念配图' : 'Concept illustration'}</span></span>
        })()}
        <button type="button" className={styles.actions} onClick={() => onOpen(post)} aria-label={copy.post}><span><MessageCircle size={16} aria-hidden="true" />{post.commentCount}</span><span><Repeat2 size={16} aria-hidden="true" /></span><span><Heart size={16} aria-hidden="true" />{post.likeCount}</span></button>
      </div>
    </article>)}
    {state === 'ready' && <div ref={sentinel} className={styles.sentinel}>
      {loadingMore ? <span className={styles.spinner} aria-label={labels.loading} /> : moreError ? <button type="button" onClick={() => void load(cursor, true, generation.current)}>{labels.retry}</button> : cursor === null ? <span>{labels.end}</span> : null}
    </div>}
  </div>
}
