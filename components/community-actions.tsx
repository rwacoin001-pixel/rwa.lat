'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Heart } from 'lucide-react'
import { request, type ApiError } from '@/lib/api/_http'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { communityCopy, type CommunityCopy } from '@/lib/maison-content-copy'

// Server messages are not localized; map by status so every locale reads its own copy.
export function communityError(error: ApiError, c: CommunityCopy) {
  if (error.status === 0) return c.network
  if (error.status === 413 || (error.status === 400 && /long|length|max/i.test(error.message))) return c.tooLong
  if (error.status === 429) return c.rateLimited
  if (error.status === 403) return c.notAllowed
  return c.failed
}

export function CommunityComposer({ guest, postId, onPublished, onLogin, topic }: { guest: boolean; postId?: string; topic?: string | null; onPublished: (id: string) => void; onLogin: () => void }) {
  const { locale } = useI18n(); const c = communityCopy[locale]
  const [body, setBody] = useState(''); const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const intent = useRef<{ text: string; key: string } | null>(null)
  if (guest) return <div className="community-join"><button type="button" onClick={onLogin}>{c.login}</button></div>
  const max = postId ? 2000 : 4000
  const send = async () => {
    if (!body.trim() || busy) return
    const payload = JSON.stringify({ body: body.trim(), lang: locale, ...(postId ? {} : { topics: topic ? [topic] : [] }) })
    // Same text keeps the same key, so a retry after a lost response cannot publish twice.
    if (intent.current?.text !== payload) intent.current = { text: payload, key: crypto.randomUUID() }
    setBusy(true); setFeedback(null)
    const result = await request<{ id: string }>(postId ? `/v1/community/me/posts/${encodeURIComponent(postId)}/comments` : '/v1/community/me/posts', { method: 'POST', body: payload, idempotencyKey: intent.current.key })
    setBusy(false)
    if (!result.ok) { setFeedback({ tone: 'error', text: communityError(result.error, c) }); return }
    intent.current = null; setBody('')
    setFeedback({ tone: 'ok', text: postId ? c.replied : c.published })
    onPublished(result.data.id)
  }
  return <form className="community-join" aria-busy={busy} onSubmit={event => { event.preventDefault(); void send() }}>
    <label><b>{postId ? c.reply : c.post}</b><textarea aria-label={postId ? c.reply : c.post} rows={3} maxLength={max} value={body} disabled={busy} placeholder={c.placeholder} dir="auto" onChange={e => { setBody(e.target.value); if (feedback?.tone === 'ok') setFeedback(null) }} className="community-report-details" /></label>
    <small>{c.public} <span className="community-counter" aria-hidden="true">{body.length}/{max}</span></small>
    {feedback && <p className="community-feedback" data-tone={feedback.tone} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
    <button type="submit" disabled={busy || !body.trim()}>{busy ? c.busy : postId ? c.reply : c.post}</button>
  </form>
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }
const followCopy: Record<AppLocale, { follow: string; following: string; unfollow: string }> = {
  'zh-CN': { follow: '关注', following: '已关注', unfollow: '取消关注' },
  en: { follow: 'Follow', following: 'Following', unfollow: 'Unfollow' },
  es: { follow: 'Seguir', following: 'Siguiendo', unfollow: 'Dejar de seguir' },
  fr: { follow: 'Suivre', following: 'Abonné', unfollow: 'Ne plus suivre' },
  pt: { follow: 'Seguir', following: 'Seguindo', unfollow: 'Deixar de seguir' },
  ar: { follow: 'متابعة', following: 'تتابعه', unfollow: 'إلغاء المتابعة' },
  hi: { follow: 'फ़ॉलो करें', following: 'फ़ॉलो कर रहे हैं', unfollow: 'अनफ़ॉलो करें' },
}
async function readState(query: Record<string, string>) {
  const result = await request<{ liked: boolean; following: boolean }>('/v1/community/me/state?' + new URLSearchParams(query))
  return result.ok ? result.data : null
}
// Feed responses carry no viewer flags; remember what this session learned so rows agree with the detail page.
const likedCache = new Map<string, boolean>()

/**
 * Heart with count. Optimistic: the tap shows at once and reverts on failure. Unknown state never locks the
 * button (the old toggle stayed disabled whenever /me/state failed); PUT is idempotent, so "assume not liked" is safe.
 */
export function CommunityLike({ postId, count, guest, onLogin, onChanged, probe = false, className, size = 18, format = String }: { postId: string; count: number; guest: boolean; onLogin: () => void; onChanged?: () => void; probe?: boolean; className?: string; size?: number; format?: (value: number) => string }) {
  const { locale } = useI18n(); const c = communityCopy[locale]
  const [liked, setLiked] = useState<boolean | null>(() => likedCache.get(postId) ?? null)
  const [delta, setDelta] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { setDelta(0) }, [count])
  useEffect(() => {
    setLiked(likedCache.get(postId) ?? null)
    if (guest || !probe || likedCache.has(postId)) return
    let live = true
    void readState({ postId }).then(state => { if (state && live) { likedCache.set(postId, state.liked); setLiked(state.liked) } })
    return () => { live = false }
  }, [guest, postId, probe])
  useEffect(() => { if (!error) return; const timer = setTimeout(() => setError(''), 2600); return () => clearTimeout(timer) }, [error])
  const toggle = async () => {
    if (guest) { onLogin(); return }
    if (busy) return
    setBusy(true); setError('')
    const was = liked ?? (await readState({ postId }))?.liked ?? false, next = !was, step = next ? 1 : -1
    setLiked(next); setDelta(value => value + step); likedCache.set(postId, next)
    const result = await request(`/v1/community/me/posts/${encodeURIComponent(postId)}/like`, { method: next ? 'PUT' : 'DELETE' })
    setBusy(false)
    if (!result.ok) { setLiked(was); setDelta(value => value - step); likedCache.set(postId, was); setError(communityError(result.error, c)); return }
    onChanged?.()
  }
  const shown = Math.max(0, count + delta)
  return <button type="button" className={className} aria-pressed={Boolean(liked)} aria-busy={busy} data-liked={liked ? 'true' : undefined} data-error={error ? 'true' : undefined} title={error || undefined} onClick={event => { event.stopPropagation(); void toggle() }}>
    <Heart size={size} strokeWidth={1.7} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
    {shown > 0 && <span aria-hidden="true">{format(shown)}</span>}
    <span style={srOnly}>{liked ? c.unlike : c.like} {shown}</span>
    <span style={srOnly} role="status">{error}</span>
  </button>
}

/** Follow / following pill. The state probe only decides the label; a failed probe still leaves it tappable. */
export function CommunityFollowButton({ handle, guest, onLogin, onChanged, className }: { handle: string; guest: boolean; onLogin: () => void; onChanged?: () => void; className?: string }) {
  const { locale } = useI18n(); const c = communityCopy[locale], f = followCopy[locale]
  const [following, setFollowing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    setFollowing(false)
    if (guest) return
    let live = true
    void readState({ handle }).then(state => { if (state && live) setFollowing(state.following) })
    return () => { live = false }
  }, [guest, handle])
  useEffect(() => { if (!error) return; const timer = setTimeout(() => setError(''), 2600); return () => clearTimeout(timer) }, [error])
  const toggle = async () => {
    if (guest) { onLogin(); return }
    if (busy) return
    const next = !following
    setBusy(true); setError(''); setFollowing(next)
    const result = await request(`/v1/community/me/profiles/${encodeURIComponent(handle)}/follow`, { method: next ? 'PUT' : 'DELETE' })
    setBusy(false)
    if (!result.ok) { setFollowing(!next); setError(communityError(result.error, c)); return }
    onChanged?.()
  }
  return <button type="button" className={className} aria-pressed={following} aria-busy={busy} data-error={error ? 'true' : undefined} title={error || undefined} onClick={() => void toggle()}>
    {following ? <><span data-rest="">{f.following}</span><span data-hover="">{f.unfollow}</span></> : <span>{f.follow}</span>}
    <span style={srOnly} role="status">{error}</span>
  </button>
}

export function CommunityToggle({ guest, postId, handle, onChanged }: { guest: boolean; postId?: string; handle?: string; onChanged: () => void }) {
  const { locale } = useI18n(); const c = communityCopy[locale]
  const [value, setValue] = useState<boolean | null>(null); const [busy, setBusy] = useState(false)
  const [error, setError] = useState(''); const [status, setStatus] = useState('')
  const load = async () => {
    setError('')
    const query = new URLSearchParams(postId ? { postId } : { handle: handle ?? '' })
    const result = await request<{ liked: boolean; following: boolean }>('/v1/community/me/state?' + query)
    if (!result.ok) { setError(result.error.status === 0 ? c.network : c.stateFailed); return }
    setValue(postId ? result.data.liked : result.data.following)
  }
  useEffect(() => { if (!guest) void load() }, [guest, postId, handle])
  if (guest) return null
  const toggle = async () => {
    if (value === null || busy) return
    setBusy(true); setError(''); setStatus('')
    const path = postId ? `/v1/community/me/posts/${encodeURIComponent(postId)}/like` : `/v1/community/me/profiles/${encodeURIComponent(handle ?? '')}/follow`
    const result = await request(path, { method: value ? 'DELETE' : 'PUT' })
    setBusy(false)
    if (!result.ok) { setError(communityError(result.error, c)); return }
    const next = !value
    setValue(next)
    setStatus(postId ? next ? c.liked : c.unliked : next ? c.followed : c.unfollowed)
    onChanged()
  }
  return <div className="community-join">
    <button type="button" disabled={busy || value === null} aria-pressed={value ?? false} onClick={() => void toggle()}>{busy ? c.sending : postId ? value ? c.unlike : c.like : value ? c.unfollow : c.follow}</button>
    <span className="community-feedback" data-tone="ok" role="status">{status}</span>
    {error && <p className="community-feedback" data-tone="error" role="alert">{error} <button type="button" onClick={() => void (value === null ? load() : toggle())}>{c.retry}</button></p>}
  </div>
}
