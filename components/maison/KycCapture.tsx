'use client'

import { Camera, IdCard, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { kycCaptureCopy } from '@/lib/kyc-capture-copy'
import { submitKycCapture, type KycCase } from '@/lib/api/account'
import css from './kyc-capture.module.css'

type PhotoStep = 'front' | 'back' | 'selfie'
type Step = 'document' | PhotoStep | 'review'
type Photo = { blob: Blob; url: string }

export default function KycCapture({ onClose, onComplete }: { onClose: () => void; onComplete: (record: KycCase) => void }) {
  const { locale } = useI18n()
  const c = kycCaptureCopy[locale]
  const [documentType, setDocumentType] = useState<'passport' | 'id_card'>('passport')
  const [step, setStep] = useState<Step>('document')
  const [photos, setPhotos] = useState<Partial<Record<PhotoStep, Photo>>>({})
  const [camera, setCamera] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const alive = useRef(false)
  const urls = useRef(new Set<string>())
  const sending = useRef(false)
  const idempotency = useRef<string | null>(null)
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCamera(false); setReady(false) }
  useEffect(() => {
    alive.current = true
    const hide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hide)
    return () => { alive.current = false; stream.current?.getTracks().forEach(track => track.stop()); urls.current.forEach(url => URL.revokeObjectURL(url)); document.removeEventListener('visibilitychange', hide) }
  }, [])
  useEffect(() => { if (camera && video.current && stream.current) video.current.srcObject = stream.current }, [camera])
  const steps: Step[] = ['document', 'front', ...(documentType === 'id_card' ? ['back' as const] : []), 'selfie', 'review']
  const openCamera = async () => {
    if (busy || sending.current) return
    stop(); setError(''); setBusy(true)
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: step === 'selfie' ? 'user' : 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false })
      if (!alive.current) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media; setCamera(true)
    } catch { if (alive.current) setError(c.cameraError) }
    finally { if (alive.current) setBusy(false) }
  }
  const capture = async () => {
    const source = video.current
    if (!source || !ready || !['front', 'back', 'selfie'].includes(step)) return
    setBusy(true); setError('')
    try {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight))
      canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale)
      const context = canvas.getContext('2d')
      if (!context || !canvas.width || !canvas.height) throw new Error('empty frame')
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .9))
      if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('invalid image')
      if (!alive.current) return
      const url = URL.createObjectURL(blob); urls.current.add(url)
      const key = step as PhotoStep
      const prior = photos[key]
      if (prior) { URL.revokeObjectURL(prior.url); urls.current.delete(prior.url) }
      setPhotos(value => ({ ...value, [key]: { blob, url } })); idempotency.current = null; stop()
    } catch { if (alive.current) setError(c.captureError) }
    finally { if (alive.current) setBusy(false) }
  }
  const submit = async () => {
    if (sending.current || !photos.front || !photos.selfie || (documentType === 'id_card' && !photos.back)) return
    sending.current = true; setBusy(true); setError('')
    idempotency.current ??= crypto.randomUUID()
    try {
      const result = await submitKycCapture({ documentType, front: photos.front.blob, back: documentType === 'id_card' ? photos.back?.blob : undefined, selfie: photos.selfie.blob, idempotencyKey: idempotency.current })
      if (!alive.current) return
      if (result.ok) onComplete(result.data)
      else setError(`${result.error.message} (${result.error.code})`)
    } finally { sending.current = false; if (alive.current) setBusy(false) }
  }
  const next = () => { stop(); setError(''); setStep(steps[steps.indexOf(step) + 1]) }
  const currentPhoto = step === 'document' || step === 'review' ? null : photos[step]
  return <section className={css.root} aria-busy={busy}>
    <div className={css.head}><h2>{c[step]}</h2><button type="button" onClick={onClose} disabled={busy} aria-label={c.cancel}><X size={18} /></button></div>
    <ol className={css.progress} aria-label={c.review}>{steps.map((item, index) => <li key={item} data-done={index <= steps.indexOf(step)} aria-current={item === step ? 'step' : undefined} />)}</ol>
    {step === 'document' ? <div className={css.choices}>{(['passport', 'id_card'] as const).map(type => <button type="button" key={type} onClick={() => { setDocumentType(type); setStep('front') }}><IdCard size={20} />{type === 'passport' ? c.passport : c.idCard}</button>)}</div>
      : step === 'review' ? <>
        <div className={css.photos}>{(['front', 'back', 'selfie'] as const).filter(key => key !== 'back' || documentType === 'id_card').map(key => <figure key={key}><img src={photos[key]?.url} alt={c[key]} /><figcaption>{c[key]}</figcaption></figure>)}</div>
        <div className={css.actions}><button type="button" className={css.action} disabled={busy} onClick={() => { setStep('front'); setError('') }}>{c.retake}</button><button type="button" className={`${css.action} ${css.primary}`} disabled={busy} onClick={() => void submit()}>{busy ? c.submitting : c.submit}</button></div>
      </> : <>
        <div className={css.camera}>
          {currentPhoto ? <img src={currentPhoto.url} alt={c[step]} /> : camera ? <><video ref={video} autoPlay muted playsInline data-selfie={step === 'selfie'} onLoadedData={() => setReady(true)} /><span className={css.guide} data-selfie={step === 'selfie'} aria-hidden="true" /></> : <Camera size={30} strokeWidth={1.3} aria-hidden="true" />}
        </div>
        <p className={css.hint}>{step === 'selfie' ? c.selfieHint : c.documentHint}</p>
        <div className={css.actions}>{currentPhoto ? <><button type="button" className={css.action} disabled={busy} onClick={() => { const key = step as PhotoStep; URL.revokeObjectURL(currentPhoto.url); urls.current.delete(currentPhoto.url); setPhotos(value => ({ ...value, [key]: undefined })); void openCamera() }}>{c.retake}</button><button type="button" className={`${css.action} ${css.primary}`} disabled={busy} onClick={next}>{c.next}</button></> : <button type="button" className={`${css.action} ${css.primary}`} disabled={busy || (camera && !ready)} onClick={() => void (camera ? capture() : openCamera())}>{camera ? c.capture : c.open}</button>}</div>
      </>}
    {error && <p className={css.error} role="alert">{error}</p>}
    <p className={css.privacy}>{c.privacy}</p>
  </section>
}
