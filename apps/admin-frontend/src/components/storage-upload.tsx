'use client'

import { useRef, useState } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadToStorage, type UploadPhase } from '@/lib/upload'
import type { PresignUploadInput, StoredObject } from '@/lib/admin-api'

const PHASE_LABELS: Record<UploadPhase, string> = {
  hashing: '计算校验和…',
  uploading: '上传中…',
  verifying: '校验与扫描…',
}

export function StorageUpload({
  bucket,
  purpose,
  productId,
  label = '上传文件',
  accept = '.pdf,.png,.jpg,.jpeg',
  onDone,
  onError,
  size = 'default',
}: {
  bucket: PresignUploadInput['bucket']
  purpose?: PresignUploadInput['purpose']
  productId?: string
  label?: string
  accept?: string
  onDone?: (object: StoredObject) => void
  onError?: (message: string) => void
  size?: 'default' | 'sm'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<UploadPhase | null>(null)
  const [error, setError] = useState('')

  const handle = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const object = await uploadToStorage(file, { bucket, purpose, productId, onProgress: setPhase })
      onDone?.(object)
    } catch (e) {
      const message = e instanceof Error ? e.message : '上传失败'
      setError(message)
      onError?.(message)
    } finally {
      setBusy(false)
      setPhase(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handle(file)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={size === 'sm' ? 'sm' : 'default'}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
        {busy && phase ? PHASE_LABELS[phase] : label}
      </Button>
      {error && <p className="max-w-[260px] text-xs text-negative">{error}</p>}
    </div>
  )
}
