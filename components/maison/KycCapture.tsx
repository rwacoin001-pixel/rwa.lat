'use client'

import { Dialog } from '@base-ui/react/dialog'
import { ArrowLeft, ArrowRight, Camera, CameraOff, Check, ChevronRight, Flashlight, FlashlightOff, IdCard, LoaderCircle, LockKeyhole, ScanFace, ShieldCheck, SwitchCamera, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { kycCaptureCopy } from '@/lib/kyc-capture-copy'
import { submitKycCapture, type KycCase } from '@/lib/api/account'
import css from './kyc-capture.module.css'

type PhotoStep = 'front' | 'back' | 'selfie'
type Step = 'document' | PhotoStep | 'review'
type Photo = { blob: Blob; url: string }
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }

export default function KycCapture({ onClose, onComplete }: { onClose: () => void; onComplete: (record: KycCase) => void }) {
  const { locale } = useI18n()
  const c = kycCaptureCopy[locale]
  const [documentType, setDocumentType] = useState<'passport' | 'id_card'>('passport')
  const [step, setStep] = useState<Step>('document')
  const [photos, setPhotos] = useState<Partial<Record<PhotoStep, Photo>>>({})
  const [camera, setCamera] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [hasTorch, setHasTorch] = useState(false)
  const [torch, setTorch] = useState(false)
  const [torchBusy, setTorchBusy] = useState(false)
  const [returnFocus] = useState(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const video = useRef<HTMLVideoElement>(null)
  const portal = useRef<HTMLDivElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const alive = useRef(false)
  const urls = useRef(new Set<string>())
  const sending = useRef(false)
  const photographing = useRef(false)
  const cameraGeneration = useRef(0)
  const idempotency = useRef<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const steps: Step[] = ['document', 'front', ...(documentType === 'id_card' ? ['back' as const] : []), 'selfie', 'review']
  const photoSteps: PhotoStep[] = documentType === 'id_card' ? ['front', 'back', 'selfie'] : ['front', 'selfie']
  const photoStep = step !== 'document' && step !== 'review'
  const currentPhoto = photoStep ? photos[step] : undefined
  const allPhotos = photoSteps.every(key => photos[key])

  const stop = () => {
    cameraGeneration.current += 1
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
    if (alive.current) { setCamera('idle'); setReady(false); setHasTorch(false); setTorch(false) }
  }

  useEffect(() => {
    alive.current = true
    const objectUrls = urls.current
    const hide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hide)
    return () => {
      alive.current = false; cameraGeneration.current += 1
      stream.current?.getTracks().forEach(track => track.stop()); stream.current = null
      objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls.clear()
      document.removeEventListener('visibilitychange', hide)
    }
  }, [])

  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [step])

  const openCamera = async (deviceId?: string) => {
    if (busy || sending.current || !photoStep || camera === 'starting') return
    stop(); setError(''); setCamera('starting')
    const generation = cameraGeneration.current
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera unavailable')
      const media = await navigator.mediaDevices.getUserMedia({
        video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: step === 'selfie' ? 'user' : 'environment' } }), width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false,
      })
      if (!alive.current || generation !== cameraGeneration.current) { media.getTracks().forEach(track => track.stop()); return }
      const source = video.current
      if (!source) { media.getTracks().forEach(track => track.stop()); throw new Error('camera unavailable') }
      stream.current = media; source.srcObject = media
      await source.play()
      if (!alive.current || generation !== cameraGeneration.current) return
      setCamera('live')
      const track = media.getVideoTracks()[0]
      setHasTorch(step !== 'selfie' && (track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch === true)
      void navigator.mediaDevices.enumerateDevices().then(devices => {
        if (alive.current && generation === cameraGeneration.current) setCameras(devices.filter(device => device.kind === 'videoinput'))
      }).catch(() => { /* Camera selection is optional. */ })
    } catch {
      if (alive.current && generation === cameraGeneration.current) { stop(); setCamera('error'); setError(c.cameraError) }
    }
  }

  const capture = async () => {
    const source = video.current
    if (!source || !ready || !photoStep || busy || photographing.current || sending.current || camera !== 'live') return
    photographing.current = true; setBusy(true); setError('')
    const key = step
    const generation = cameraGeneration.current
    try {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight))
      canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale)
      const context = canvas.getContext('2d')
      if (!context || !canvas.width || !canvas.height) throw new Error('empty frame')
      // Keep the entire sensor frame for document/liveness checks; the guide never crops evidence.
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .9))
      if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('invalid image')
      if (!alive.current || generation !== cameraGeneration.current) return
      const url = URL.createObjectURL(blob); urls.current.add(url)
      const prior = photos[key]
      if (prior) { URL.revokeObjectURL(prior.url); urls.current.delete(prior.url) }
      setPhotos(value => ({ ...value, [key]: { blob, url } })); idempotency.current = null; stop()
    } catch { if (alive.current) setError(c.captureError) }
    finally { photographing.current = false; if (alive.current) setBusy(false) }
  }

  const retake = (key: PhotoStep) => {
    if (busy) return
    stop(); setError(''); setStep(key)
    const prior = photos[key]
    if (prior) { URL.revokeObjectURL(prior.url); urls.current.delete(prior.url) }
    setPhotos(value => ({ ...value, [key]: undefined })); idempotency.current = null
  }

  const submit = async () => {
    if (sending.current || !photos.front || !photos.selfie || (documentType === 'id_card' && !photos.back)) return
    sending.current = true; setBusy(true); setError('')
    try {
      idempotency.current ??= crypto.randomUUID()
      const result = await submitKycCapture({ documentType, front: photos.front.blob, back: documentType === 'id_card' ? photos.back?.blob : undefined, selfie: photos.selfie.blob, idempotencyKey: idempotency.current })
      if (!alive.current) return
      if (result.ok) onComplete(result.data)
      else setError(`${result.error.message} (${result.error.code})`)
    } catch { if (alive.current) setError(c.submitError) }
    finally { sending.current = false; if (alive.current) setBusy(false) }
  }

  const move = (target: Step) => { stop(); setError(''); setStep(target) }
  const next = () => {
    if (!photoStep || !currentPhoto) return
    const missing = photoSteps.find(key => !photos[key])
    move(missing ?? 'review')
  }
  const back = () => move(steps[Math.max(0, steps.indexOf(step) - 1)])
  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0]
    if (!track || !hasTorch || torchBusy) return
    setTorchBusy(true)
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      if (alive.current && stream.current?.getVideoTracks()[0] === track) { setTorch(!torch); setError('') }
    } catch { if (alive.current) setError(c.flashError) }
    finally { if (alive.current) setTorchBusy(false) }
  }
  const switchCamera = () => {
    const current = stream.current?.getVideoTracks()[0]?.getSettings().deviceId
    const index = cameras.findIndex(device => device.deviceId === current)
    const nextCamera = cameras[(index + 1) % cameras.length]
    if (nextCamera) void openCamera(nextCamera.deviceId)
  }
  const chooseDocument = (type: 'passport' | 'id_card') => {
    if (type !== documentType) {
      urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); setPhotos({}); idempotency.current = null
    }
    setDocumentType(type); move('front')
  }

  return <Dialog.Root open disablePointerDismissal onOpenChange={(open, details) => { if (!open) { if (busy) details.cancel(); else onClose() } }}>
    <div ref={portal} />
    <Dialog.Portal container={portal}>
    <Dialog.Popup className={css.root} data-capture={photoStep} data-preview={Boolean(currentPhoto)} aria-busy={busy || camera === 'starting'} initialFocus={heading} finalFocus={() => returnFocus}>
      <div className={css.shell}>
        {photoStep && <><video className={css.video} ref={video} autoPlay muted playsInline data-selfie={step === 'selfie'} onLoadedData={() => { if (stream.current && video.current?.videoWidth) setReady(true) }} aria-hidden="true" /><div className={css.shade} aria-hidden="true" /></>}
        <header className={css.head}>
          {step === 'document' ? <span className={css.brand}><ShieldCheck size={17} strokeWidth={1.6} aria-hidden="true" />{c.identity}</span> : <button type="button" className={css.iconButton} disabled={busy} aria-label={c.previous} onClick={back}><ArrowLeft size={20} strokeWidth={1.7} aria-hidden="true" /></button>}
          {step !== 'document' && <span className={css.stepCount} aria-hidden="true">{new Intl.NumberFormat(locale).format(steps.indexOf(step))} / {new Intl.NumberFormat(locale).format(steps.length - 1)}</span>}
          <Dialog.Close className={css.iconButton} disabled={busy} aria-label={c.cancel}><X size={20} strokeWidth={1.7} aria-hidden="true" /></Dialog.Close>
        </header>
        <ol className={css.progress} aria-label={c.identity}>{steps.map((item, index) => <li key={item} aria-label={c[item]} data-done={index < steps.indexOf(step)} data-current={item === step} aria-current={item === step ? 'step' : undefined} />)}</ol>
        <main className={css.main}>
          <div className={css.intro}><Dialog.Title ref={heading} tabIndex={-1} className={css.title}>{c[step]}</Dialog.Title><Dialog.Description className={css.hint}>{step === 'document' ? c.chooseHint : step === 'review' ? c.reviewHint : currentPhoto ? c.photoHint : step === 'selfie' ? c.selfieHint : c.documentHint}</Dialog.Description></div>
          {step === 'document' ? <div className={css.choices}>{(['passport', 'id_card'] as const).map(type => <button type="button" key={type} onClick={() => chooseDocument(type)}><span className={css.documentIcon}><IdCard size={27} strokeWidth={1.25} aria-hidden="true" /></span><span><b>{type === 'passport' ? c.passport : c.idCard}</b><small>{type === 'passport' ? c.passportHint : c.idCardHint}</small></span><ChevronRight size={17} aria-hidden="true" /></button>)}</div>
            : step === 'review' ? <div className={css.photos}>{photoSteps.map(key => <figure key={key}><div className={css.photoThumbnail}>{photos[key] && <img src={photos[key].url} width={1600} height={1200} alt={c[key]} />}</div><figcaption><span><Check size={13} aria-hidden="true" />{c[key]}</span><button type="button" disabled={busy} onClick={() => retake(key)} aria-label={`${c.retake}: ${c[key]}`}>{c.retake}</button></figcaption></figure>)}</div>
              : currentPhoto ? <div className={css.preview}><img src={currentPhoto.url} width={1600} height={1200} alt={c[step]} /></div>
                : <div className={css.frame} data-selfie={step === 'selfie'} aria-hidden="true">{step === 'selfie' ? <ScanFace className={css.placeholder} size={48} strokeWidth={1} data-hidden={camera === 'live'} /> : <Camera className={css.placeholder} size={40} strokeWidth={1} data-hidden={camera === 'live'} />}<span className={css.guide}><i /><i /><i /><i /></span>{camera === 'starting' && <LoaderCircle className={css.spinner} size={24} />}{camera === 'error' && <CameraOff size={28} strokeWidth={1.3} />}</div>}
          {error && <p className={css.error} role="alert">{error}</p>}
          {photoStep && !currentPhoto && !error && <p className={css.cameraStatus} role="status" aria-live="polite">{camera === 'starting' ? c.opening : camera === 'live' && !ready ? c.opening : camera === 'live' ? c.ready : c.cameraHint}</p>}
        </main>
        <footer className={css.footer}>
          {step === 'review' ? <button type="button" className={`${css.action} ${css.primary}`} disabled={busy || !allPhotos} onClick={() => void submit()}>{busy ? <LoaderCircle size={17} className={css.spinner} aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}{busy ? c.submitting : c.submit}</button>
            : photoStep && currentPhoto ? <div className={css.actions}><button type="button" className={css.action} disabled={busy} onClick={() => retake(step)}>{c.retake}</button><button type="button" className={`${css.action} ${css.primary}`} disabled={busy} onClick={next}>{c.next}<ArrowRight size={16} aria-hidden="true" /></button></div>
              : photoStep ? <div className={css.captureControls}>
                <div className={css.controlSlot}>{hasTorch && <button type="button" className={css.iconButton} aria-label={torch ? c.flashOff : c.flashOn} aria-pressed={torch} disabled={busy || torchBusy} onClick={() => void toggleTorch()}>{torch ? <FlashlightOff size={20} aria-hidden="true" /> : <Flashlight size={20} aria-hidden="true" />}</button>}</div>
                <button type="button" className={css.shutter} aria-label={camera === 'live' ? c.capture : c.open} disabled={busy || camera === 'starting' || (camera === 'live' && !ready)} onClick={() => void (camera === 'live' ? capture() : openCamera())}>{busy || camera === 'starting' ? <LoaderCircle size={22} className={css.spinner} aria-hidden="true" /> : camera === 'live' ? <span aria-hidden="true" /> : <Camera size={25} strokeWidth={1.5} aria-hidden="true" />}</button>
                <div className={css.controlSlot}>{cameras.length > 1 && camera === 'live' && <button type="button" className={css.iconButton} aria-label={c.switchCamera} disabled={busy || torchBusy} onClick={switchCamera}><SwitchCamera size={21} strokeWidth={1.6} aria-hidden="true" /></button>}</div>
                <span className={css.captureLabel}>{camera === 'live' ? c.capture : c.open}</span>
              </div> : null}
          <p className={css.privacy}><LockKeyhole size={12} strokeWidth={1.6} aria-hidden="true" />{c.privacy}</p>
        </footer>
      </div>
    </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
