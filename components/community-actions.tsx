'use client'

import { useEffect, useRef, useState } from 'react'
import { request, type ApiError } from '@/lib/api/_http'
import { useI18n } from '@/lib/i18n'
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
