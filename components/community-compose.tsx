'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Camera, Globe2, Hash, ImagePlus, MapPin, Maximize2, Trash2, X } from 'lucide-react'
import { getPostLocation, locationCopy, type PostLocation } from '@/lib/community-location'
import { request, readSession, SESSION_CHANGED, type ApiError } from '@/lib/api/_http'
import { useI18n } from '@/lib/i18n'
import { communityCopy } from '@/lib/maison-content-copy'
import { communityComposeCopy, type CommunityComposeCopy } from '@/lib/maison-community-compose-copy'
import type { CommunityTopic } from '@/lib/community-data'
import { communityError } from './community-actions'
import { CommunityAvatar } from './community-avatar'
import x from './maison/community.module.css'
import { communityExperienceCopy } from '@/lib/community-experience-copy'
import { useCommunityMe, publishCommunityMe, type CommunityMe } from '@/lib/use-community-me'
export { useCommunityMe, publishCommunityMe, type CommunityMe } from '@/lib/use-community-me'

/* ── Own community profile (GET /v1/community/me), shared across screens ── */


/* ── Image upload ── */

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGES = 4
const MAX_BYTES = { post: 10 * 1024 * 1024, avatar: 5 * 1024 * 1024 }
type Uploaded = { objectId: string; scanStatus: string }

/** Large photos are re-encoded on device (max 2560px JPEG); this also drops EXIF such as location. GIFs keep their animation. */
async function prepareImage(file: File, limit: number): Promise<Blob> {
  if (file.type === 'image/gif' || (file.size <= 1.5 * 1024 * 1024 && file.size <= limit)) return file
  if (file.type !== 'image/jpeg' && file.size <= limit) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .86))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export async function uploadCommunityImage(file: File, purpose: 'post' | 'avatar'): Promise<{ ok: true; data: Uploaded } | { ok: false; error: 'type' | 'size' | ApiError }> {
  if (!IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'type' }
  const blob = await prepareImage(file, MAX_BYTES[purpose])
  if (blob.size > MAX_BYTES[purpose]) return { ok: false, error: 'size' }
  const form = new FormData()
  form.append('file', blob, blob === file ? file.name : file.name.replace(/\.\w+$/, '') + '.jpg')
  const result = await request<Uploaded>(`/v1/community/me/media?purpose=${purpose}`, { method: 'POST', body: form, loading: 'silent', timeoutMs: 90_000 })
  return result.ok ? result : { ok: false, error: result.error }
}

function uploadMessage(error: 'type' | 'size' | ApiError, k: CommunityComposeCopy) {
  if (error === 'type') return k.imageType
  if (error === 'size' || error.status === 413) return k.imageSize
  if (error.status === 415 || (error.status === 400 && /type|image|format/i.test(error.message))) return k.imageType
  return k.imageFailed
}

/* ── Drafts (device-local, per account) ── */

type Draft = { id: string; body: string; topic: string | null; at: number }
const draftsKey = () => `rwa.community.drafts.${readSession()?.userId ?? 'member'}`
const replyKey = (postId: string) => `rwa.community.reply.${readSession()?.userId ?? 'member'}.${postId}`
function readDrafts(): Draft[] {
  try { const value = JSON.parse(window.localStorage.getItem(draftsKey()) ?? '[]'); return Array.isArray(value) ? value.filter((d): d is Draft => typeof d?.id === 'string' && typeof d?.body === 'string') : [] } catch { return [] }
}
function writeDrafts(drafts: Draft[]) {
  try { window.localStorage.setItem(draftsKey(), JSON.stringify(drafts.slice(0, 30))) } catch { /* storage full or disabled: drafts are best effort */ }
}

/** Page portal target so overlays keep the Maison theme tokens. */
function useMaisonContainer() {
  const anchor = useRef<HTMLSpanElement>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  useEffect(() => { setContainer(anchor.current?.closest<HTMLElement>('[data-maison-page]') ?? null) }, [])
  return { anchor, container }
}

/** Character ring: fills as the limit nears, shows the remainder in the last 20, turns red past it. */
function CharRing({ used, max, label }: { used: number; max: number; label: string }) {
  const left = max - used
  const r = 9, c = 2 * Math.PI * r
  const near = left <= 20
  return <span className={x.ring} data-state={left < 0 ? 'over' : near ? 'near' : 'ok'} role="img" aria-label={label.replace('{n}', String(left))}>
    <svg viewBox="0 0 24 24" width={near ? 28 : 22} height={near ? 28 : 22} aria-hidden="true">
      <circle cx="12" cy="12" r={r} className={x.ringTrack} />
      <circle cx="12" cy="12" r={r} className={x.ringFill} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, used / max))} transform="rotate(-90 12 12)" />
    </svg>
    {near && <b>{left}</b>}
  </span>
}

/* ── Full-screen composer ── */

export type ComposeTarget = { kind: 'post'; topic?: string | null } | { kind: 'reply'; postId: string; handle?: string | null }
type Shot = { key: string; preview: string; status: 'uploading' | 'done' | 'error'; id?: string; pending?: boolean }

export function CommunityCompose({ open, onClose, target, me, topics = [], initialFiles, onPublished }: {
  open: boolean; onClose: () => void; target: ComposeTarget; me: CommunityMe | null; topics?: CommunityTopic[]
  initialFiles?: File[] | null; onPublished: (id: string) => void
}) {
  const { locale } = useI18n()
  const k = communityComposeCopy[locale]; const c = communityCopy[locale]
  const { anchor, container } = useMaisonContainer()
  const reply = target.kind === 'reply'
  const max = reply ? 2000 : 4000
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState<string | null>(null)
  const [shots, setShots] = useState<Shot[]>([])
  const [draftId, setDraftId] = useState<string | null>(null)
  const [panel, setPanel] = useState<null | 'confirm' | 'drafts' | 'topics'>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [identityOpen, setIdentityOpen] = useState(false)
  const liveMe = useCommunityMe(false)
  const currentMe = liveMe ?? me
  useEffect(() => { if (open && currentMe && !currentMe.identityConfigured) setIdentityOpen(true) }, [open, currentMe?.id, currentMe?.identityConfigured])
  const [location, setLocation] = useState<PostLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationFailed, setLocationFailed] = useState(false)
  const locationAttempt = useRef(0)
  const locate = useCallback(async () => {
    const attempt = ++locationAttempt.current
    setLocation(null); setLocating(true); setLocationFailed(false)
    try {
      const result = await getPostLocation(locale)
      if (locationAttempt.current === attempt) setLocation(result)
    } catch { if (locationAttempt.current === attempt) setLocationFailed(true) }
    finally { if (locationAttempt.current === attempt) setLocating(false) }
  }, [locale])
  useEffect(() => {
    if (!open || reply) return
    void locate()
    return () => { ++locationAttempt.current }
  }, [open, reply, locate])
  const popup = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const intent = useRef<{ text: string; key: string } | null>(null)
  const shotsRef = useRef<Shot[]>([])
  shotsRef.current = shots

  const clearShots = useCallback(() => { shotsRef.current.forEach(s => URL.revokeObjectURL(s.preview)); setShots([]) }, [])

  const addFiles = useCallback((files: File[]) => {
    setError('')
    const room = MAX_IMAGES - shotsRef.current.length
    if (files.length > room) setError(k.imageLimit)
    for (const file of files.slice(0, Math.max(0, room))) {
      const shot: Shot = { key: crypto.randomUUID(), preview: URL.createObjectURL(file), status: 'uploading' }
      setShots(list => [...list, shot])
      void uploadCommunityImage(file, 'post').then(result => {
        if (!result.ok) setError(uploadMessage(result.error, k))
        setShots(list => list.map(s => s.key !== shot.key ? s : result.ok ? { ...s, status: 'done', id: result.data.objectId, pending: result.data.scanStatus !== 'clean' } : { ...s, status: 'error' }))
      })
    }
  }, [k])

  // Fresh state on every open; a reply resumes its saved draft.
  useEffect(() => {
    if (!open) return
    setPanel(null); setError(''); setBusy(false); setDraftId(null); intent.current = null
    setTopic(target.kind === 'post' ? target.topic ?? null : null)
    let restored = ''
    if (target.kind === 'reply') { try { restored = window.localStorage.getItem(replyKey(target.postId)) ?? '' } catch { /* ignore */ } }
    setBody(restored)
    if (initialFiles?.length) addFiles(initialFiles)
    // Reset only when the composer opens; later prop changes must not wipe what is being written.
  }, [open])

  // Keep the toolbar above the on-screen keyboard (iOS does not resize the layout viewport).
  useEffect(() => {
    const vv = window.visualViewport
    if (!open || !vv) return
    const sync = () => popup.current?.style.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`)
    sync(); vv.addEventListener('resize', sync); vv.addEventListener('scroll', sync)
    return () => { vv.removeEventListener('resize', sync); vv.removeEventListener('scroll', sync) }
  }, [open, container])

  // Auto-grow the text field with its content.
  useEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`
  }, [body, open])

  const trimmed = body.trim()
  const ready = shots.filter(s => s.status === 'done')
  const uploading = shots.some(s => s.status === 'uploading')
  const hasContent = trimmed.length > 0 || shots.length > 0
  const canSend = (trimmed.length > 0 || ready.length > 0) && !uploading && body.length <= max && !busy && (reply || Boolean(location))

  const finish = () => { clearShots(); setBody(''); onClose() }
  const requestClose = () => {
    if (busy) return
    if (panel) { setPanel(null); return }
    if (hasContent) { setPanel('confirm'); return }
    finish()
  }
  const saveDraft = () => {
    if (target.kind === 'reply') {
      try { window.localStorage.setItem(replyKey(target.postId), body) } catch { /* ignore */ }
    } else if (trimmed) {
      const draft: Draft = { id: draftId ?? crypto.randomUUID(), body, topic, at: Date.now() }
      writeDrafts([draft, ...readDrafts().filter(d => d.id !== draft.id)])
    }
    finish()
  }
  const discard = () => {
    if (target.kind === 'reply') { try { window.localStorage.removeItem(replyKey(target.postId)) } catch { /* ignore */ } }
    finish()
  }
  const openDrafts = () => { setDrafts(readDrafts()); setPanel('drafts') }
  const applyDraft = (draft: Draft) => {
    // Keep what is on screen: it becomes a draft before the chosen one replaces it.
    if (trimmed && draftId !== draft.id) writeDrafts([{ id: draftId ?? crypto.randomUUID(), body, topic, at: Date.now() }, ...readDrafts().filter(d => d.id !== draftId)])
    setBody(draft.body); setTopic(draft.topic); setDraftId(draft.id); setPanel(null)
    requestAnimationFrame(() => field.current?.focus())
  }
  const deleteDraft = (id: string) => { const next = readDrafts().filter(d => d.id !== id); writeDrafts(next); setDrafts(next); if (draftId === id) setDraftId(null) }

  const send = async () => {
    if (!canSend) return
    if (!currentMe?.identityConfigured) { setIdentityOpen(true); return }
    const imageIds = ready.map(s => s.id!)
    const payload = JSON.stringify({ body: trimmed, lang: locale, ...(reply ? {} : { topics: topic ? [topic] : [], location }), ...(imageIds.length ? { imageIds } : {}) })
    // Same payload keeps the same key, so a retry after a lost response cannot publish twice.
    if (intent.current?.text !== payload) intent.current = { text: payload, key: crypto.randomUUID() }
    setBusy(true); setError('')
    const path = target.kind === 'reply' ? `/v1/community/me/posts/${encodeURIComponent(target.postId)}/comments` : '/v1/community/me/posts'
    const result = await request<{ id: string }>(path, { method: 'POST', body: payload, idempotencyKey: intent.current.key, loading: 'silent' })
    setBusy(false)
    if (!result.ok) { if (/COMMUNITY_IDENTITY_REQUIRED/.test(result.error.message)) setIdentityOpen(true); else setError(communityError(result.error, c)); return }
    intent.current = null
    if (target.kind === 'reply') { try { window.localStorage.removeItem(replyKey(target.postId)) } catch { /* ignore */ } }
    else if (draftId) writeDrafts(readDrafts().filter(d => d.id !== draftId))
    finish()
    onPublished(result.data.id)
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>) => { addFiles([...(event.target.files ?? [])]); event.target.value = '' }
  const topicLabel = topic ? topics.find(t => t.slug === topic)?.title ?? topic : k.topic

  return <><span ref={anchor} hidden />
    <Dialog.Root open={open} onOpenChange={next => { if (!next) requestClose() }}>
      <Dialog.Portal container={container}>
        <Dialog.Popup ref={popup} className={x.compose} initialFocus={field} aria-busy={busy}>
          <div className={x.composeHead}>
            <button type="button" className={x.iconBtn} aria-label={k.close} onClick={requestClose}><X size={22} strokeWidth={1.85} /></button>
            <Dialog.Title className={x.srOnly}>{reply ? k.reply : k.post}</Dialog.Title>
            <span className={x.grow} />
            {!reply && <button type="button" className={x.textBtn} onClick={openDrafts}>{k.drafts}</button>}
            <button type="button" className={x.postBtn} disabled={!canSend} onClick={() => void send()}>{busy ? c.busy : reply ? k.reply : k.post}</button>
          </div>
          <div className={x.composeBody}>
            <CommunityAvatar avatarUrl={me?.avatarUrl} seed={me?.avatarSeed} handle={me?.handle} size={40} />
            <div className={x.composeMain}>
              {target.kind === 'reply' && target.handle && <p className={x.replyingTo}>{k.replyingTo} <span dir="ltr">@{target.handle}</span></p>}
              <textarea ref={field} className={x.composeField} value={body} dir="auto" rows={2} disabled={busy}
                aria-label={reply ? k.replyPlaceholder : k.placeholder} placeholder={reply ? k.replyPlaceholder : k.placeholder}
                onChange={event => { setBody(event.target.value); if (error) setError('') }} />
              {shots.length > 0 && <ul className={x.shots} data-count={shots.length}>
                {shots.map(shot => <li key={shot.key} data-status={shot.status}>
                  <img src={shot.preview} alt="" />
                  {shot.status === 'uploading' && <span className={x.shotBusy} role="status" aria-label={k.uploading} />}
                  <button type="button" className={x.shotRemove} aria-label={k.removeImage} onClick={() => { URL.revokeObjectURL(shot.preview); setShots(list => list.filter(s => s.key !== shot.key)) }}><X size={15} strokeWidth={2.4} /></button>
                </li>)}
              </ul>}
              {ready.some(s => s.pending) && <p className={x.composeNote}>{k.imagesPending}</p>}
            </div>
          </div>
          {panel === 'topics' && !reply && <div className={x.topicPick} role="group" aria-label={k.topic}>
            <button type="button" aria-pressed={topic === null} onClick={() => { setTopic(null); setPanel(null) }}>{k.noTopic}</button>
            {topics.map(entry => <button key={entry.slug} type="button" aria-pressed={topic === entry.slug} onClick={() => { setTopic(entry.slug); setPanel(null) }}>#{entry.title}</button>)}
          </div>}
          <div className={x.composeTools}>
            {!reply && <>
              <button type="button" className={x.toolChip} disabled={locating || busy} onClick={() => void locate()}><MapPin size={16} aria-hidden="true" />{locating ? locationCopy[locale][1] : location ? `${location.city} · ${location.countryCode}` : locationCopy[locale][locationFailed ? 2 : 0]}</button>
              <p className={x.composeNote}>{locationCopy[locale][3]}</p>
            </>}
            {error && <p className={x.composeError} role="alert">{error}</p>}
            <p className={x.audience}><Globe2 size={15} strokeWidth={2} aria-hidden="true" />{k.everyone}</p>
            <div className={x.toolRow}>
              <button type="button" className={x.toolBtn} aria-label={k.addImage} disabled={shots.length >= MAX_IMAGES || busy} onClick={() => picker.current?.click()}><ImagePlus size={21} strokeWidth={1.8} /></button>
              <input ref={picker} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={onPick} />
              {!reply && <button type="button" className={x.toolChip} aria-expanded={panel === 'topics'} data-set={topic !== null} onClick={() => setPanel(panel === 'topics' ? null : 'topics')}><Hash size={16} strokeWidth={2} aria-hidden="true" /><span>{topicLabel}</span></button>}
              <span className={x.grow} />
              {body.length > 0 && <CharRing used={body.length} max={max} label={k.remaining} />}
            </div>
          </div>
          {panel === 'confirm' && <div className={x.confirm} role="alertdialog" aria-modal="true" aria-labelledby="community-compose-confirm">
            <div className={x.confirmCard}>
              <b id="community-compose-confirm">{k.saveTitle}</b>
              <button type="button" className={x.confirmMain} onClick={saveDraft} autoFocus>{k.saveDraft}</button>
              <button type="button" className={x.confirmDanger} onClick={discard}>{k.discard}</button>
              <button type="button" className={x.confirmPlain} onClick={() => setPanel(null)}>{k.cancel}</button>
            </div>
          </div>}
          {panel === 'drafts' && <div className={x.drafts} role="region" aria-labelledby="community-drafts-title">
            <div className={x.composeHead}>
              <button type="button" className={x.iconBtn} aria-label={k.close} onClick={() => setPanel(null)}><X size={22} strokeWidth={1.85} /></button>
              <h2 id="community-drafts-title" className={x.sheetTitle}>{k.draftsTitle}</h2>
            </div>
            {drafts.length === 0 ? <p className={x.draftsEmpty}>{k.draftsEmpty}</p> : <ul className={x.draftList}>
              {drafts.map(draft => <li key={draft.id}>
                <button type="button" className={x.draftOpen} aria-label={k.draftUse} onClick={() => applyDraft(draft)}>
                  <span dir="auto">{draft.body}</span>
                  <time dateTime={new Date(draft.at).toISOString()}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draft.at))}</time>
                </button>
                <button type="button" className={x.iconBtn} aria-label={k.draftDelete} onClick={() => deleteDraft(draft.id)}><Trash2 size={18} strokeWidth={1.8} /></button>
              </li>)}
            </ul>}
          </div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    {currentMe && <CommunityProfileEditor open={identityOpen} onOpenChange={setIdentityOpen} me={currentMe} onSaved={() => undefined} />}
    </>
}

/* ── Post detail reply bar ── */

export function CommunityReplyBar({ me, guest, onOpen, onLogin }: { me: CommunityMe | null; guest: boolean; onOpen: (files?: File[]) => void; onLogin: () => void }) {
  return guest ? <GuestReplyBar onLogin={onLogin} /> : <MemberReplyBar me={me} onOpen={onOpen} />
}

function GuestReplyBar({ onLogin }: { onLogin: () => void }) {
  const { t } = useI18n()
  return <div className={x.replyBar} data-guest="true">
    <span className={x.guestPrompt}>{t('community.joinTitle')}</span>
    <button type="button" className={x.guestSignin} onClick={onLogin}>{t('guest.signin')}</button>
  </div>
}

function MemberReplyBar({ me, onOpen }: { me: CommunityMe | null; onOpen: (files?: File[]) => void }) {
  const { locale } = useI18n(); const k = communityComposeCopy[locale]
  const picker = useRef<HTMLInputElement>(null)
  return <div className={x.replyBar}>
    <CommunityAvatar avatarUrl={me?.avatarUrl} seed={me?.avatarSeed} handle={me?.handle ?? 'guest'} size={32} />
    <button type="button" className={x.replyPrompt} onClick={() => onOpen()}>{k.replyBar}</button>
    <button type="button" className={x.toolBtn} aria-label={k.addImage} onClick={() => picker.current?.click()}><ImagePlus size={20} strokeWidth={1.8} /></button>
    <input ref={picker} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; if (files.length) onOpen(files) }} />
    <button type="button" className={x.toolBtn} aria-label={k.expand} onClick={() => onOpen()}><Maximize2 size={18} strokeWidth={1.9} /></button>
  </div>
}

/* ── Own profile editor (avatar, name, bio) ── */

export function CommunityProfileEditor({ open, onOpenChange, me, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; me: CommunityMe; onSaved: () => void }) {
  const { locale } = useI18n(); const k = communityComposeCopy[locale]
  const { anchor, container } = useMaisonContainer()
  const [name, setName] = useState(me.displayName)
  const [handle, setHandle] = useState(me.handleBase || '')
  const [profileLocation, setProfileLocation] = useState<PostLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const experience = communityExperienceCopy[locale]
  const validHandle = /^[a-zA-Z0-9_]{3,20}$/.test(handle)
  const [bio, setBio] = useState(me.bio ?? '')
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'avatar' | 'save'>(null)
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setName(me.displayName); setHandle(me.handleBase || ''); setProfileLocation(null); setBio(me.bio ?? ''); setNote(null) } }, [open, me.displayName, me.bio, me.handleBase])
  const locateProfile = async () => {
    setLocating(true); setNote(null)
    try { const value=await getPostLocation(locale);setProfileLocation(value);return value } catch { setNote({tone:'error',text:locationCopy[locale][2]});return null } finally {setLocating(false)}
  }
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pickAvatar = async (file: File | undefined) => {
    if (!file || busy) return
    const actor=readSession()?.userId??null
    if(!actor)return
    setBusy('avatar'); setNote(null)
    const uploaded = await uploadCommunityImage(file, 'avatar')
    if(actor!==readSession()?.userId){setBusy(null);return}
    if (!uploaded.ok) { setBusy(null); setNote({ tone: 'error', text: uploadMessage(uploaded.error, k) }); return }
    const result = await request<CommunityMe>('/v1/community/me/avatar', { method: 'PUT', body: JSON.stringify({ objectId: uploaded.data.objectId }), loading: 'silent' })
    setBusy(null)
    if (!result.ok) { setNote({ tone: 'error', text: k.imageFailed }); return }
    if(!publishCommunityMe(result.data,actor))return
    setPreview(URL.createObjectURL(file))
    if (result.data.avatarPending) setNote({ tone: 'ok', text: k.avatarPending })
    onSaved()
  }
  const removeAvatar = async () => {
    if (busy) return
    const actor=readSession()?.userId??null
    if(!actor)return
    setBusy('avatar'); setNote(null)
    const result = await request<CommunityMe>('/v1/community/me/avatar', { method: 'DELETE', loading: 'silent' })
    setBusy(null)
    if (!result.ok) { setNote({ tone: 'error', text: k.saveFailed }); return }
    if(!publishCommunityMe(result.data,actor))return
    setPreview(null); onSaved()
  }
  const save = async () => {
    if (!name.trim() || busy || locating || !validHandle) return
    const actor=readSession()?.userId??null
    if(!actor)return
    const chosenLocation=profileLocation ?? (!me.city ? await locateProfile() : null)
    if (!chosenLocation && !me.city) return
    if(actor!==readSession()?.userId)return
    setBusy('save'); setNote(null)
    const result = await request<CommunityMe>('/v1/community/me', { method: 'PUT', body: JSON.stringify({ displayName: name.trim(), handle, bio: bio.trim(), ...(chosenLocation ? {location:chosenLocation} : {}) }), loading: 'silent' })
    setBusy(null)
    if (!result.ok) { setNote({ tone: 'error', text: k.saveFailed }); return }
    if(!publishCommunityMe(result.data,actor))return
    onSaved(); onOpenChange(false)
  }
  const hasAvatar = Boolean(preview || me.avatarUrl || me.avatarPending)

  return <><span ref={anchor} hidden />
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={x.backdrop} />
        <Dialog.Popup className={`${x.sheet} ${x.editSheet}`}>
          <div className={x.sheetHead}>
            <Dialog.Close className={x.iconBtn} aria-label={k.close}><X size={22} strokeWidth={1.85} /></Dialog.Close>
            <Dialog.Title className={x.sheetTitle}>{me.identityConfigured ? k.editProfile : experience.setup}</Dialog.Title>
            <span className={x.grow} />
            <button type="button" className={x.postBtn} disabled={!name.trim() || !validHandle || locating || busy !== null} onClick={() => void save()}>{busy === 'save' ? k.saving : k.save}</button>
          </div>
          <div className={x.editAvatar}>
            <button type="button" className={x.editAvatarBtn} aria-label={k.changeAvatar} disabled={busy !== null} onClick={() => picker.current?.click()}>
              {preview ? <img className={x.avatar} style={{ width: 84, height: 84 }} src={preview} alt="" /> : <CommunityAvatar avatarUrl={me.avatarUrl} seed={me?.avatarSeed} handle={me.handle} size={84} />}
              <span className={x.editAvatarCam} data-busy={busy === 'avatar'} aria-hidden="true"><Camera size={22} strokeWidth={1.8} /></span>
            </button>
            <input ref={picker} type="file" accept={IMAGE_TYPES.join(',')} hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void pickAvatar(file) }} />
            <div className={x.editAvatarActions}>
              <button type="button" className={x.textBtn} disabled={busy !== null} onClick={() => picker.current?.click()}>{busy === 'avatar' ? k.uploading : k.changeAvatar}</button>
              {hasAvatar && <button type="button" className={x.textBtnMuted} disabled={busy !== null} onClick={() => void removeAvatar()}>{k.removeAvatar}</button>}
            </div>
          </div>
          {(note || me.avatarPending) && <p className={x.editNote} data-tone={note?.tone ?? 'ok'} role={note?.tone === 'error' ? 'alert' : 'status'}>{note?.text ?? k.avatarPending}</p>}
          <label className={x.editField}><span>{k.displayName}</span><input value={name} maxLength={64} dir="auto" onChange={event => setName(event.target.value)} /></label>
          <label className={x.editField}><span>{experience.username}</span><input value={handle} maxLength={20} dir="ltr" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="zhangqi" onChange={event => setHandle(event.target.value)} /><small>{handle && !validHandle ? experience.invalid : experience.hint}</small></label>
          <button type="button" className={x.textBtn} disabled={locating || busy !== null} onClick={() => void locateProfile()}>{locating ? locationCopy[locale][1] : profileLocation?.city || me.city || experience.location}</button>
          {me.handle && <p className={x.editNote} dir="ltr">@{me.handle}</p>}
          <label className={x.editField}><span>{k.bio}</span><textarea value={bio} maxLength={280} rows={3} dir="auto" onChange={event => setBio(event.target.value)} /><small>{bio.length}/280</small></label>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root></>
}
