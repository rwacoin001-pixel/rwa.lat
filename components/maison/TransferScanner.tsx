'use client'

import { Dialog } from '@base-ui/react/dialog'
import { CameraOff, Flashlight, FlashlightOff, ImagePlus, LoaderCircle, RotateCw, ScanLine, SwitchCamera, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { transferScannerCopy } from '@/lib/transfer-scanner-copy'
import css from './transfer-scanner.module.css'

type Decoder = (data: Uint8ClampedArray, width: number, height: number, options?: unknown) => { data: string } | null
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
let decoderJob: Promise<Decoder> | null = null

/** The locally bundled Apache-2.0 jsQR is loaded only when capture is opened. */
function decoder(): Promise<Decoder> {
  const existing = (window as unknown as { jsQR?: Decoder }).jsQR
  if (existing) return Promise.resolve(existing)
  if (decoderJob) return decoderJob
  decoderJob = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/vendor/jsqr/jsQR.js'
    const failed = () => { decoderJob = null; script.remove(); reject(new Error('decoder unavailable')) }
    script.onload = () => {
      const fn = (window as unknown as { jsQR?: Decoder }).jsQR
      if (fn) resolve(fn)
      else failed()
    }
    script.onerror = failed
    document.head.appendChild(script)
  })
  return decoderJob
}

export function TransferScanner({ onCode, onClose }: { onCode: (text: string) => boolean; onClose: () => void }) {
  const { locale } = useI18n()
  const c = transferScannerCopy[locale]
  const video = useRef<HTMLVideoElement>(null)
  const portal = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const callback = useRef(onCode)
  const close = useRef(onClose)
  const alive = useRef(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const accepted = useRef(false)
  const galleryBusy = useRef(false)
  const [returnFocus] = useState(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const [cameraRequest, setCameraRequest] = useState({ attempt: 0, deviceId: '' })
  const [status, setStatus] = useState<'starting' | 'scanning' | 'unavailable'>('starting')
  const [error, setError] = useState<keyof typeof c | null>(null)
  const [uploading, setUploading] = useState(false)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [hasTorch, setHasTorch] = useState(false)
  const [torch, setTorch] = useState(false)
  const [torchBusy, setTorchBusy] = useState(false)
  callback.current = onCode
  close.current = onClose

  const stop = () => {
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }

  useEffect(() => {
    alive.current = true
    const hidden = () => { if (document.hidden) { stop(); close.current() } }
    document.addEventListener('visibilitychange', hidden)
    return () => { alive.current = false; stop(); document.removeEventListener('visibilitychange', hidden) }
  }, [])

  useEffect(() => {
    let active = true
    let decoding = false
    const run = async () => {
      setStatus('starting'); setError(null); setHasTorch(false); setTorch(false)
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera unavailable')
        const qr = await decoder()
        if (!active) return
        const media = await navigator.mediaDevices.getUserMedia({
          video: { ...(cameraRequest.deviceId ? { deviceId: { exact: cameraRequest.deviceId } } : { facingMode: { ideal: 'environment' } }), width: { ideal: 1280 } }, audio: false,
        })
        if (!active) { media.getTracks().forEach(track => track.stop()); return }
        stream.current = media
        const source = video.current
        if (!source) { stop(); return }
        source.srcObject = media
        await source.play()
        if (!active) return
        const track = media.getVideoTracks()[0]
        setHasTorch((track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch === true)
        setStatus('scanning')
        void navigator.mediaDevices.enumerateDevices().then(devices => {
          if (active) setCameras(devices.filter(device => device.kind === 'videoinput'))
        }).catch(() => { /* Camera selection is optional. */ })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('canvas unavailable')
        timer.current = setInterval(() => {
          if (decoding || galleryBusy.current || accepted.current || !active || !source.videoWidth) return
          decoding = true
          try {
            const scale = Math.min(1, 720 / source.videoWidth)
            canvas.width = Math.round(source.videoWidth * scale)
            canvas.height = Math.round(source.videoHeight * scale)
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
            const result = qr(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
            if (!result) return
            if (callback.current(result.data)) { accepted.current = true; stop(); close.current() }
            else setError('invalid')
          } catch { if (active) setError('invalid') }
          finally { decoding = false }
        }, 250)
      } catch (cause) {
        if (!active) return
        stop(); setStatus('unavailable')
        setError(cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError') ? 'permissionError' : 'cameraError')
      }
    }
    void run()
    return () => { active = false; stop() }
  }, [cameraRequest])

  const upload = async (file: File) => {
    if (galleryBusy.current || accepted.current) return
    galleryBusy.current = true; setUploading(true); setError(null)
    let bitmap: ImageBitmap | undefined
    try {
      if (file.size > 15_000_000) { setError('imageTooLarge'); return }
      bitmap = await createImageBitmap(file)
      if (!alive.current) return
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas unavailable')
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const qr = await decoder()
      if (!alive.current) return
      const result = qr(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
      if (!result || !callback.current(result.data)) { setError('invalid'); return }
      accepted.current = true; stop(); close.current()
    } catch { if (alive.current) setError('imageError') }
    finally { bitmap?.close(); galleryBusy.current = false; if (alive.current) setUploading(false) }
  }

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0]
    if (!track || !hasTorch || torchBusy) return
    setTorchBusy(true)
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      if (alive.current && stream.current?.getVideoTracks()[0] === track) { setTorch(!torch); setError(null) }
    } catch { if (alive.current) setError('flashError') }
    finally { if (alive.current) setTorchBusy(false) }
  }

  const switchCamera = () => {
    const current = stream.current?.getVideoTracks()[0]?.getSettings().deviceId
    const index = cameras.findIndex(device => device.deviceId === current)
    const next = cameras[(index + 1) % cameras.length]
    if (next) setCameraRequest(value => ({ attempt: value.attempt + 1, deviceId: next.deviceId }))
  }

  return <Dialog.Root open disablePointerDismissal onOpenChange={open => { if (!open) close.current() }}>
    <div ref={portal} />
    <Dialog.Portal container={portal}>
    <Dialog.Popup className={css.root} initialFocus={true} finalFocus={() => returnFocus} aria-busy={uploading}>
      <div className={css.shell} data-camera-state={status}>
        <video className={css.video} ref={video} muted playsInline aria-hidden="true" />
        <div className={css.shade} aria-hidden="true" />
        <header className={css.head}>
          <span className={css.brand} aria-hidden="true"><ScanLine size={18} strokeWidth={1.6} />RWA</span>
          <Dialog.Close className={css.iconButton} aria-label={c.close}><X size={20} strokeWidth={1.7} aria-hidden="true" /></Dialog.Close>
        </header>
        <div className={css.viewfinder}>
          <Dialog.Title className={css.title}>{c.title}</Dialog.Title>
          <Dialog.Description className={css.hint}>{c.hint}</Dialog.Description>
          <div className={css.frame} aria-hidden="true"><i /><i /><i /><i />{status === 'unavailable' ? <CameraOff size={36} strokeWidth={1.2} /> : status === 'starting' ? <LoaderCircle className={css.spinner} size={24} strokeWidth={1.5} /> : null}</div>
          <div className={css.status} role="status" aria-live="polite">
            {error ? <p className={css.error}>{c[error]}</p> : <p><i data-active={status === 'scanning'} aria-hidden="true" />{uploading ? c.reading : status === 'starting' ? c.starting : c.scanning}</p>}
            {status === 'unavailable' && <button className={css.retry} type="button" disabled={uploading} onClick={() => setCameraRequest(value => ({ ...value, attempt: value.attempt + 1 }))}><RotateCw size={15} aria-hidden="true" />{c.retry}</button>}
          </div>
        </div>
        <footer className={css.footer}>
          <div className={css.controls}>
            {hasTorch && <button className={css.tool} type="button" aria-label={torch ? c.flashOff : c.flashOn} aria-pressed={torch} disabled={torchBusy || uploading} onClick={() => void toggleTorch()}><span className={css.iconButton} data-active={torch}>{torch ? <FlashlightOff size={20} aria-hidden="true" /> : <Flashlight size={20} aria-hidden="true" />}</span><small>{torch ? c.flashOff : c.flashOn}</small></button>}
            <button className={css.tool} type="button" disabled={uploading} onClick={() => fileInput.current?.click()}><span className={css.gallery}>{uploading ? <LoaderCircle size={22} className={css.spinner} aria-hidden="true" /> : <ImagePlus size={22} strokeWidth={1.6} aria-hidden="true" />}</span><small>{c.gallery}</small></button>
            {cameras.length > 1 && status === 'scanning' && <button className={css.tool} type="button" disabled={uploading || torchBusy} onClick={switchCamera}><span className={css.iconButton}><SwitchCamera size={21} strokeWidth={1.6} aria-hidden="true" /></span><small>{c.switchCamera}</small></button>}
          </div>
          <p className={css.note}>{c.review}</p>
          <input ref={fileInput} className={css.fileInput} type="file" accept="image/*" aria-label={c.gallery} disabled={uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
        </footer>
      </div>
    </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
