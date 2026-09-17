'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminApi, type StorageReadiness, type StoredObject } from '@/lib/admin-api'
import { StorageUpload } from '@/components/storage-upload'
import { AdminLayout } from '@/components/layout/AdminLayout'

const SCAN_LABELS: Record<string, string> = {
  pending: '待扫描',
  clean: '已校验',
  quarantined: '已隔离',
  failed: '扫描失败',
}
const SCAN_BADGES: Record<string, 'softGreen' | 'softAmber' | 'softRed' | 'softGray'> = {
  pending: 'softAmber',
  clean: 'softGreen',
  quarantined: 'softRed',
  failed: 'softGray',
}
const BUCKET_LABELS: Record<string, string> = {
  'rwa-assets': '产品与披露资产',
  'rwa-kyc': 'KYC 资料',
  'rwa-attachments': '附件',
}

function formatBytes(value: string | number): string {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function FilesPage() {
  const [items, setItems] = useState<StoredObject[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [bucket, setBucket] = useState('all')
  const [scanStatus, setScanStatus] = useState('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [readiness, setReadiness] = useState<StorageReadiness | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await adminApi.listObjects({
        bucket: bucket === 'all' ? undefined : bucket,
        scanStatus: scanStatus === 'all' ? undefined : scanStatus,
        q: q.trim() || undefined,
        page,
        pageSize,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '加载失败' })
    } finally {
      setLoading(false)
    }
  }, [bucket, scanStatus, q, page, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    adminApi
      .getStorageReadiness()
      .then(setReadiness)
      .catch(() => setReadiness(null))
  }, [])

  const openObject = async (object: StoredObject, mode: 'inline' | 'attachment') => {
    setBusyId(object.id)
    try {
      const res = await adminApi.downloadObject(object.id, mode)
      window.open(res.url, '_blank')
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '无法生成链接' })
    } finally {
      setBusyId('')
    }
  }

  const rescan = async (object: StoredObject) => {
    setBusyId(object.id)
    try {
      const updated = await adminApi.scanObject(object.id)
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setNotice({ kind: 'ok', text: '已重新扫描' })
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '扫描失败' })
    } finally {
      setBusyId('')
    }
  }

  const remove = async (object: StoredObject) => {
    if (!window.confirm(`删除文件「${object.key.split('/').pop()}」？该操作不可恢复。`)) return
    setBusyId(object.id)
    try {
      await adminApi.deleteObject(object.id)
      setNotice({ kind: 'ok', text: '文件已删除' })
      await load()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '删除失败' })
    } finally {
      setBusyId('')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const cleanCount = items.filter((item) => item.scanStatus === 'clean').length

  return (
    <AdminLayout>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">文件管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">产品媒体、披露文件与附件的统一文件库（Cloudflare R2 直传 + 安全校验）</p>
        </div>
        <div className="flex items-center gap-2">
          <StorageUpload
            bucket="rwa-assets"
            purpose="misc"
            label="上传文件"
            onDone={() => {
              setNotice({ kind: 'ok', text: '上传完成，已加入文件库' })
              void load()
            }}
            onError={(message) => setNotice({ kind: 'error', text: message })}
          />
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} title="刷新">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm ${
            notice.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {notice.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs opacity-60 hover:opacity-100">
            关闭
          </button>
        </div>
      )}

      {/* 统计 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">文件总数</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint/12 text-mint">
              <FileText className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">本页已校验</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">{cleanCount}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">存储服务</p>
              <p className="mt-1 text-lg font-semibold">
                {readiness ? (readiness.enabled ? '已启用' : '未启用') : '—'}
                {readiness?.enabled && (
                  <span className="ml-2 text-xs font-normal text-text-faint">
                    {readiness.scanMode === 'internal-basic' ? '内置基础扫描' : '外部扫描'}
                  </span>
                )}
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <HardDrive className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 筛选 */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <Input
                className="pl-9"
                placeholder="搜索文件名 / 对象键…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Select
              value={bucket}
              onValueChange={(v) => {
                setBucket(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部存储桶</SelectItem>
                <SelectItem value="rwa-assets">产品与披露资产</SelectItem>
                <SelectItem value="rwa-kyc">KYC 资料</SelectItem>
                <SelectItem value="rwa-attachments">附件</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={scanStatus}
              onValueChange={(v) => {
                setScanStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="clean">已校验</SelectItem>
                <SelectItem value="pending">待扫描</SelectItem>
                <SelectItem value="quarantined">已隔离</SelectItem>
                <SelectItem value="failed">扫描失败</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-52 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-text-faint" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center gap-2 text-text-faint">
              <FileText className="h-9 w-9 opacity-50" />
              <p className="text-sm">文件库还没有文件：点击右上角「上传文件」开始</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/[0.08] text-left text-xs text-text-faint">
                    <th className="px-5 py-3 font-medium">文件</th>
                    <th className="px-4 py-3 font-medium">存储桶</th>
                    <th className="px-4 py-3 font-medium">大小</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">上传时间</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-ink/[0.05] transition-colors last:border-0 hover:bg-white/60">
                      <td className="max-w-[320px] px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 flex-shrink-0 text-text-faint" />
                          <div className="min-w-0">
                            <p className="truncate font-medium" title={item.key}>
                              {item.key.split('/').pop()}
                            </p>
                            <p className="truncate font-mono text-[11px] text-text-faint">{item.contentType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{BUCKET_LABELS[item.bucket] ?? item.bucket}</td>
                      <td className="px-4 py-3 tabular-nums text-text-secondary">{formatBytes(item.sizeBytes)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={SCAN_BADGES[item.scanStatus] ?? 'softGray'}>{SCAN_LABELS[item.scanStatus] ?? item.scanStatus}</Badge>
                      </td>
                      <td className="px-4 py-3 text-text-faint">{new Date(item.uploadedAt).toLocaleString('zh-CN')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          {item.scanStatus === 'clean' ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="预览" onClick={() => void openObject(item, 'inline')} disabled={busyId === item.id}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="下载" onClick={() => void openObject(item, 'attachment')} disabled={busyId === item.id}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="重新扫描" onClick={() => void rescan(item)} disabled={busyId === item.id}>
                              {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-negative"
                            title="删除"
                            onClick={() => void remove(item)}
                            disabled={busyId === item.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink/[0.06] px-5 py-3">
            <p className="text-xs text-text-faint">
              共 {total} 条 · 第 {page} / {totalPages} 页
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 上一页
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                下一页 <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {readiness && !readiness.enabled && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-amber-800">
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{readiness.message}</p>
          </CardContent>
        </Card>
      )}
    </div>
    </AdminLayout>
  )
}
