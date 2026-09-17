'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, ImageIcon, Loader2, RefreshCw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { adminApi, type StoredObject } from '@/lib/admin-api'
import { StorageUpload } from '@/components/storage-upload'

function ObjectThumb({ object, selected, onSelect }: { object: StoredObject; selected: boolean; onSelect: (object: StoredObject) => void }) {
  const [url, setUrl] = useState('')
  const isImage = object.contentType.startsWith('image/')
  useEffect(() => {
    let cancelled = false
    if (!isImage) return
    adminApi
      .downloadObject(object.id, 'inline')
      .then((res) => {
        if (!cancelled) setUrl(res.url)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [object.id, isImage])

  return (
    <button
      type="button"
      onClick={() => onSelect(object)}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white/70 text-left transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-glass ${
        selected ? 'border-mint ring-2 ring-mint/30' : 'border-ink/[0.10]'
      }`}
    >
      <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-ink/[0.04]">
        {isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={object.key} className="h-full w-full object-cover" />
        ) : isImage ? (
          <Loader2 className="h-5 w-5 animate-spin text-text-faint" />
        ) : (
          <FileText className="h-7 w-7 text-text-faint" />
        )}
      </span>
      <span className="flex flex-col gap-1 p-2.5">
        <span className="truncate text-xs font-medium" title={object.key}>
          {object.key.split('/').pop()}
        </span>
        <span className="flex items-center gap-1.5">
          <Badge variant="softGreen" className="px-2 py-0 text-[10px]">
            已校验
          </Badge>
          <span className="text-[10px] text-text-faint">{(Number(object.sizeBytes) / 1024).toFixed(0)} KB</span>
        </span>
      </span>
    </button>
  )
}

export function StoragePicker({
  open,
  onOpenChange,
  onSelect,
  bucket = 'rwa-assets',
  productId,
  title = '从文件库选择',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (object: StoredObject) => void
  bucket?: 'rwa-kyc' | 'rwa-assets' | 'rwa-attachments'
  productId?: string
  title?: string
}) {
  const [items, setItems] = useState<StoredObject[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await adminApi.listObjects({ bucket, scanStatus: 'clean', q, pageSize: 48 })
      setItems(page.items)
      setTotal(page.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [bucket, q])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>仅显示已通过安全校验的文件 · 点击选中，可直接上传新文件</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
            <Input
              className="pl-9"
              placeholder="搜索文件名…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load()
              }}
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} title="刷新">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <StorageUpload
            bucket={bucket}
            purpose="product-media"
            productId={productId}
            label="上传新文件"
            size="sm"
            onDone={(object) => {
              setSelectedId(object.id)
              void load()
            }}
            onError={setError}
          />
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <div className="max-h-[420px] overflow-y-auto pr-1">
          {loading && !items.length ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-text-faint" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-text-faint">
              <ImageIcon className="h-8 w-8 opacity-60" />
              <p className="text-sm">文件库还没有可用文件</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((object) => (
                <ObjectThumb
                  key={object.id}
                  object={object}
                  selected={selectedId === object.id}
                  onSelect={(picked) => {
                    setSelectedId(picked.id)
                    onSelect(picked)
                    onOpenChange(false)
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-text-faint">共 {total} 个文件（已校验）</p>
      </DialogContent>
    </Dialog>
  )
}
