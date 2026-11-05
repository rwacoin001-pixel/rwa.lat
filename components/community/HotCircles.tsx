'use client'

/**
 * Popular circles under my circles (2026-11-05, user: some hot circles below, scrolling on and on; richer cards).
 * Ten at a time, the next ten load as the end comes into view. Each card: a solid colour cover (one of eight deep tones,
 * fixed per circle) with the name's first character set large and cropped like a magazine masthead, the owner's photo
 * over its edge, the name, owner and ID, the intro in two lines, then recent posters, members and posts this week, and
 * one key — ask to join (the owner approves), waiting, or open.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CommunityAvatar } from '@/components/community-avatar'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { applyToCircleById, discoverCircles, type CircleDiscoverItem } from '@/lib/community-circles'
import { useCircleStageCopy } from './circle-copy'
import { openCircle } from './CircleList'
import { useTimeAgo } from './PostCard'
import l from './circle-list.module.css'

type Copy = { title: string; members: (n: string) => string; week: (n: number) => string; end: string; failed: string; retry: string; sent: string; sentSub: string; owner: string; waiting: string }
const COPY: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': { title: '热门圈子', members: (n) => `${n} 位成员`, week: (n) => `本周 ${n} 帖`, end: '已经到底了', failed: '没有加载出来。', retry: '重试', sent: '申请已发出', sentSub: '圈主同意后，你会收到通知', owner: '圈主', waiting: '等待同意' },
  en: { title: 'Popular circles', members: (n) => `${n} members`, week: (n) => `${n} posts this week`, end: 'That is all for now', failed: 'Could not load.', retry: 'Retry', sent: 'Request sent', sentSub: 'We will let you know when the owner approves', owner: 'Owner', waiting: 'Requested' },
}
const TONES = 8
const toneOf = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % TONES

export function HotCircles({ onNotify }: { onNotify: (text: string, more?: { sub?: string; ok?: boolean }) => void }) {
  const { locale } = useI18n()
  const k = COPY[locale] ?? COPY.en!
  const labels = useCircleStageCopy(), timeAgo = useTimeAgo()
  const [items, setItems] = useState<CircleDiscoverItem[]>([])
  const [next, setNext] = useState<number | null>(0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const inflight = useRef(false)

  const more = useCallback(() => {
    if (inflight.current || next === null) return
    inflight.current = true; setLoading(true); setFailed(false)
    void discoverCircles(next).then((page) => {
      setItems((previous) => [...previous, ...page.items.filter((row) => !previous.some((p) => p.circle.id === row.circle.id))])
      setNext(page.nextOffset)
    }).catch(() => setFailed(true)).finally(() => { inflight.current = false; setLoading(false) })
  }, [next])

  // Load the first page, then the next whenever the end of the list comes within a screen of view. The observer is
  // made again after each page lands, so an end that is already in view loads the next page at once.
  useEffect(() => {
    const node = end.current
    if (!node || failed || loading) return
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) more() }, { rootMargin: '600px 0px' })
    io.observe(node)
    return () => io.disconnect()
  }, [more, failed, loading])

  const apply = async (row: CircleDiscoverItem) => {
    if (busy) return
    setBusy(row.circle.id)
    try {
      const status = await applyToCircleById(row.circle.id)
      setItems((previous) => previous.map((item) => item.circle.id === row.circle.id ? { ...item, status } : item))
      if (status === 'member' || status === 'owner') openCircle(row.circle.id)
      else if (status === 'pending') onNotify(k.sent, { sub: k.sentSub, ok: true })
    } catch (error) {
      if (error instanceof Error && error.message === 'CIRCLE_REMOVED') setItems((previous) => previous.map((item) => item.circle.id === row.circle.id ? { ...item, status: 'removed' } : item))
      else onNotify(labels.failed)
    } finally { setBusy(null) }
  }
  const number = (n: number) => new Intl.NumberFormat(locale).format(n)

  if (!items.length && !loading && next === null && !failed) return null
  return <section className={l.section} aria-label={k.title}>
    <h2 className={l.label}>{k.title}</h2>
    <ul className={l.hotList}>{items.map(({ circle, status }, index) => {
      const inside = status === 'member' || status === 'owner'
      return <li key={circle.id} className={l.hotCard} style={{ ['--i' as string]: index % 10 }}>
        <div className={l.cover} data-tone={toneOf(circle.id)} aria-hidden="true">
          <span className={l.glyph} dir="auto">{Array.from(circle.name)[0]}</span>
          {index < 3 && <span className={l.rank}>No.{index + 1}</span>}
        </div>
        <div className={l.hotBody}>
          <span className={l.hotAvatar}><CommunityAvatar avatarUrl={circle.owner?.avatarUrl ?? null} seed={circle.owner?.avatarSeed ?? circle.id} handle={circle.owner?.handle ?? ''} size={52} /></span>
          <div className={l.hotHead}>
            <b dir="auto">{circle.name}</b>
            <small>{k.owner} <span dir="auto">{circle.owner?.displayName}</span> · ID {circle.publicNo}</small>
          </div>
          {circle.intro && <p className={l.hotIntro} dir="auto">{circle.intro}</p>}
          <div className={l.hotFoot}>
            {circle.faces.length > 0 && <span className={l.faces} aria-hidden="true">{circle.faces.slice(0, 3).map((f) => <CommunityAvatar key={f.id} avatarUrl={f.avatarUrl} seed={f.avatarSeed} handle={f.handle} size={24} />)}</span>}
            <span className={l.hotMeta}><b>{k.members(number(circle.memberCount))}</b><small>{circle.postsWeek > 0 ? k.week(circle.postsWeek) : circle.lastPostAt ? timeAgo(circle.lastPostAt) : ''}</small></span>
            {status === 'removed' ? <span className={l.tag}>{labels.removed}</span>
              : inside ? <button type="button" className={l.hotKey} onClick={() => openCircle(circle.id)}>{labels.enter}</button>
              : <button type="button" className={l.hotKey} data-solid={status === 'pending' ? undefined : ''} disabled={busy !== null || status === 'pending'} aria-busy={busy === circle.id || undefined} onClick={() => void apply({ circle, status })}>{status === 'pending' ? k.waiting : labels.apply}</button>}
          </div>
        </div>
      </li>
    })}</ul>
    {loading && <ul className={l.hotList} aria-hidden="true">{[0, 1].map((i) => <li key={i} className={`${l.hotCard} ${l.hotGhost}`}><div className={l.cover} /><div className={l.hotBody}><span /><span /></div></li>)}</ul>}
    {failed && <p className={l.note} role="alert">{k.failed}<button type="button" onClick={() => setFailed(false)}>{k.retry}</button></p>}
    {next === null && items.length > 0 && <p className={l.endNote}>{k.end}</p>}
    <div ref={end} className={l.sentinel} aria-hidden="true" />
  </section>
}
