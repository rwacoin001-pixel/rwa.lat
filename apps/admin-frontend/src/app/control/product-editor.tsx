'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  FileText,
  FolderOpen,
  ImagePlus,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminApi, type AdminProduct, type AssetClass, type Disclosure, type PriceQuote, type StoredObject } from '@/lib/admin-api'
import type { YieldTerms } from '@/lib/yield-terms'
import { StoragePicker } from '@/components/storage-picker'
import { StorageUpload } from '@/components/storage-upload'
import { YieldEditor } from './yield-editor'

const STATE_LABELS: Record<string, string> = { draft: '草稿', published: '已发布', suspended: '已暂停', retired: '已归档' }
const STATE_BADGE: Record<string, 'softGray' | 'softGreen' | 'softAmber' | 'softRed'> = {
  draft: 'softGray',
  published: 'softGreen',
  suspended: 'softAmber',
  retired: 'softRed',
}
const NETWORK_LABELS: Record<string, string> = { tron: 'TRON', ethereum: 'Ethereum', arbitrum: 'Arbitrum' }
const DISCLOSURE_KIND_LABELS: Record<string, string> = {
  prospectus: '发行说明',
  risk_disclosure: '风险披露',
  terms: '条款',
  regulatory: '监管文件',
}
const LOCALES = ['zh-CN', 'en-US', 'es-ES', 'ar-SA', 'fr-FR', 'pt-BR', 'hi-IN']

function toAtomic(human: string, decimals: number): string | null {
  const trimmed = human.trim()
  if (!trimmed) return null
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  const [int, frac = ''] = trimmed.split('.')
  if (frac.length > decimals) return null
  const joined = int + frac.padEnd(decimals, '0')
  return joined.replace(/^0+(?=\d)/, '')
}

function fromAtomic(atomic: string | null | undefined, decimals: number): string {
  if (!atomic) return ''
  const s = String(atomic).padStart(decimals + 1, '0')
  const int = s.slice(0, s.length - decimals) || '0'
  const frac = s.slice(s.length - decimals).replace(/0+$/, '')
  return frac ? `${int}.${frac}` : int
}

async function resolveObjectByRef(ref: string): Promise<StoredObject | undefined> {
  const slash = ref.indexOf('/')
  if (slash < 0) return undefined
  const bucket = ref.slice(0, slash)
  const key = ref.slice(slash + 1)
  try {
    const page = await adminApi.listObjects({ bucket, q: key.split('/').pop() ?? key, pageSize: 20 })
    return page.items.find((item) => item.bucket === bucket && item.key === key)
  } catch {
    return undefined
  }
}

function RefPreview({ storageRef, onRemove }: { storageRef: string; onRemove: () => void }) {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<'loading' | 'image' | 'file' | 'missing'>('loading')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const object = await resolveObjectByRef(storageRef)
      if (cancelled) return
      if (!object) {
        setState('missing')
        return
      }
      if (object.contentType.startsWith('image/')) {
        try {
          const res = await adminApi.downloadObject(object.id, 'inline')
          if (!cancelled) {
            setUrl(res.url)
            setState('image')
          }
        } catch {
          if (!cancelled) setState('file')
        }
      } else {
        setState('file')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [storageRef])

  const open = async () => {
    if (url) {
      window.open(url, '_blank')
      return
    }
    const object = await resolveObjectByRef(storageRef)
    if (object) {
      const res = await adminApi.downloadObject(object.id, 'inline')
      window.open(res.url, '_blank')
    }
  }

  return (
    <div className="group relative flex w-[132px] flex-col overflow-hidden rounded-2xl border border-ink/[0.10] bg-white/70">
      <button type="button" onClick={() => void open()} className="flex h-[92px] items-center justify-center overflow-hidden bg-ink/[0.04]">
        {state === 'image' && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={storageRef} className="h-full w-full object-cover" />
        ) : state === 'loading' ? (
          <Loader2 className="h-5 w-5 animate-spin text-text-faint" />
        ) : (
          <FileText className="h-7 w-7 text-text-faint" />
        )}
      </button>
      <div className="flex items-center justify-between gap-1 p-2">
        <span className="truncate text-[11px] text-text-secondary" title={storageRef}>
          {storageRef.split('/').pop()}
        </span>
        <button type="button" onClick={() => void open()} className="text-text-faint hover:text-mint" title="打开">
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-white/90 text-negative shadow-sm group-hover:flex"
        title="移除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {state === 'missing' && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">找不到</span>
      )}
    </div>
  )
}

export function ProductEditor({
  product,
  assetClasses,
  onBack,
  onChanged,
}: {
  product: AdminProduct
  assetClasses: AssetClass[]
  onBack: () => void
  onChanged: () => void
}) {
  const [current, setCurrent] = useState(product)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // 基本信息
  const [basic, setBasic] = useState({
    displayName: product.displayName,
    assetClassId: product.assetClassId,
    externalRef: product.externalRef ?? '',
    assetCode: product.assetCode,
    assetDecimals: String(product.assetDecimals),
    network: product.network ?? 'none',
    summary: product.summary ?? '',
    minHuman: fromAtomic(product.minOrderAtomicAmount, product.assetDecimals),
    maxHuman: fromAtomic(product.maxOrderAtomicAmount, product.assetDecimals),
  })
  // 利率与收益
  const [yieldTerms, setYieldTerms] = useState<YieldTerms>((product.yieldTerms ?? {}) as YieldTerms)
  // 风险披露
  const risk = (product.riskDisclosure ?? {}) as Record<string, unknown>
  const [riskLevel, setRiskLevel] = useState<string>(String(risk.riskLevel ?? 'R3'))
  const [riskItems, setRiskItems] = useState(Array.isArray(risk.riskItems) ? (risk.riskItems as string[]).join('\n') : '')
  const [worstCaseText, setWorstCaseText] = useState(String(risk.worstCaseText ?? ''))
  const [riskNotes, setRiskNotes] = useState(String(risk.notes ?? ''))
  // 媒体
  const [mediaRefs, setMediaRefs] = useState<string[]>(product.mediaRefs ?? [])
  const [pickerOpen, setPickerOpen] = useState(false)
  // 报价 / 披露
  const [quotes, setQuotes] = useState<PriceQuote[]>([])
  const [disclosures, setDisclosures] = useState<Disclosure[]>([])
  const [priceForm, setPriceForm] = useState({ priceHuman: '', currency: 'USDT', source: 'admin', validUntil: '' })
  const [disclosureForm, setDisclosureForm] = useState({ kind: 'risk_disclosure', locale: 'zh-CN', title: '' })

  const loadRelated = useCallback(async () => {
    try {
      const [prices, discs] = await Promise.all([adminApi.listPrices(current.id), adminApi.listDisclosures(current.id)])
      setQuotes(prices)
      setDisclosures(discs)
    } catch {
      // 忽略单次加载失败；保存动作会再次触发
    }
  }, [current.id])

  useEffect(() => {
    void loadRelated()
  }, [loadRelated])

  const showOk = (text: string) => setNotice({ kind: 'ok', text })
  const showError = (e: unknown, fallback: string) => setNotice({ kind: 'error', text: e instanceof Error ? e.message : fallback })

  const saveBasic = async () => {
    setBusy('basic')
    setNotice(null)
    try {
      const decimals = Number(basic.assetDecimals)
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('资产精度需为 0-18 的整数')
      const min = toAtomic(basic.minHuman, decimals)
      const max = toAtomic(basic.maxHuman, decimals)
      if (basic.minHuman.trim() && min === null) throw new Error('最小下单额格式不正确')
      if (basic.maxHuman.trim() && max === null) throw new Error('最大下单额格式不正确')
      const updated = await adminApi.updateProduct(current.id, {
        displayName: basic.displayName.trim(),
        assetClassId: basic.assetClassId,
        externalRef: basic.externalRef.trim() || undefined,
        assetCode: basic.assetCode.trim().toUpperCase(),
        assetDecimals: decimals,
        network: basic.network === 'none' ? undefined : (basic.network as 'tron' | 'ethereum' | 'arbitrum'),
        summary: basic.summary.trim() || undefined,
        minOrderAtomicAmount: min ?? undefined,
        maxOrderAtomicAmount: max ?? undefined,
      })
      setCurrent(updated)
      showOk('基本信息已保存')
      onChanged()
    } catch (e) {
      showError(e, '保存失败')
    } finally {
      setBusy('')
    }
  }

  const saveYield = async () => {
    setBusy('yield')
    setNotice(null)
    try {
      const updated = await adminApi.updateProduct(current.id, { yieldTerms: yieldTerms as Record<string, unknown> })
      setCurrent(updated)
      showOk('利率与收益条款已保存')
      onChanged()
    } catch (e) {
      showError(e, '保存失败')
    } finally {
      setBusy('')
    }
  }

  const saveRisk = async () => {
    setBusy('risk')
    setNotice(null)
    try {
      const updated = await adminApi.updateProduct(current.id, {
        riskDisclosure: {
          ...risk,
          riskLevel,
          riskItems: riskItems
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          worstCaseText: worstCaseText.trim(),
          notes: riskNotes.trim(),
        },
      })
      setCurrent(updated)
      showOk('风险披露已保存')
      onChanged()
    } catch (e) {
      showError(e, '保存失败')
    } finally {
      setBusy('')
    }
  }

  const persistMedia = async (next: string[]) => {
    setBusy('media')
    setNotice(null)
    try {
      const updated = await adminApi.updateProduct(current.id, { mediaRefs: next })
      setCurrent(updated)
      setMediaRefs(updated.mediaRefs ?? next)
      onChanged()
    } catch (e) {
      showError(e, '保存媒体失败')
    } finally {
      setBusy('')
    }
  }

  const addMediaRef = async (ref: string) => {
    if (mediaRefs.includes(ref)) return
    await persistMedia([...mediaRefs, ref])
  }

  const addQuote = async () => {
    setBusy('quote')
    setNotice(null)
    try {
      const decimals = current.assetDecimals
      const atomic = toAtomic(priceForm.priceHuman, decimals)
      if (atomic === null) throw new Error('价格格式不正确')
      if (!priceForm.validUntil) throw new Error('请选择报价有效期')
      const validUntil = new Date(priceForm.validUntil)
      if (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date()) throw new Error('有效期必须晚于当前时间')
      const list = await adminApi.addPrice(current.id, {
        unitPriceAtomicAmount: atomic,
        currency: priceForm.currency,
        source: priceForm.source.trim() || 'admin',
        validUntil: validUntil.toISOString(),
      })
      setQuotes(list)
      setPriceForm({ priceHuman: '', currency: priceForm.currency, source: priceForm.source, validUntil: '' })
      showOk('报价已录入')
      onChanged()
    } catch (e) {
      showError(e, '录入报价失败')
    } finally {
      setBusy('')
    }
  }

  const submitDisclosure = async (object: StoredObject) => {
    setNotice(null)
    if (!disclosureForm.title.trim()) {
      setNotice({ kind: 'error', text: '请先填写披露文件标题，再上传文件' })
      return
    }
    try {
      const list = await adminApi.addDisclosure(current.id, {
        kind: disclosureForm.kind as 'prospectus' | 'risk_disclosure' | 'terms' | 'regulatory',
        locale: disclosureForm.locale,
        title: disclosureForm.title.trim(),
        storageRef: object.storageRef,
        contentHash: object.checksumSha256 ?? '',
      })
      setDisclosures(list)
      setDisclosureForm({ ...disclosureForm, title: '' })
      showOk('披露文件已登记')
    } catch (e) {
      showError(e, '登记披露文件失败')
    }
  }

  const changeState = async (state: 'published' | 'suspended' | 'retired') => {
    const label = STATE_LABELS[state]
    if (!window.confirm(`确认将产品状态改为「${label}」？`)) return
    setBusy('state')
    setNotice(null)
    try {
      const updated = await adminApi.setProductState(current.id, state)
      setCurrent(updated)
      showOk(`产品已${label}`)
      onChanged()
    } catch (e) {
      showError(e, '状态变更失败')
    } finally {
      setBusy('')
    }
  }

  const openDisclosure = async (ref: string) => {
    const object = await resolveObjectByRef(ref)
    if (!object) {
      setNotice({ kind: 'error', text: '找不到该文件对应对象（可能已删除）' })
      return
    }
    try {
      const res = await adminApi.downloadObject(object.id, 'inline')
      window.open(res.url, '_blank')
    } catch (e) {
      showError(e, '无法生成下载链接')
    }
  }

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} title="返回列表">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight">{current.displayName}</h2>
              <Badge variant={STATE_BADGE[current.state] ?? 'softGray'}>{STATE_LABELS[current.state] ?? current.state}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {current.assetCode} · 更新于 {new Date(current.updatedAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {current.state !== 'published' && (
            <Button size="sm" onClick={() => void changeState('published')} disabled={busy === 'state'}>
              发布
            </Button>
          )}
          {current.state === 'published' && (
            <Button size="sm" variant="outline" onClick={() => void changeState('suspended')} disabled={busy === 'state'}>
              暂停
            </Button>
          )}
          {current.state !== 'retired' && (
            <Button size="sm" variant="ghost" className="text-negative" onClick={() => void changeState('retired')} disabled={busy === 'state'}>
              归档
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm ${
            notice.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {notice.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notice.text}
        </div>
      )}

      {/* 基本信息 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>产品名称、代码、网络与下单额度</CardDescription>
          </div>
          <Button size="sm" onClick={() => void saveBasic()} disabled={busy === 'basic'}>
            {busy === 'basic' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>产品名称</Label>
            <Input value={basic.displayName} onChange={(e) => setBasic({ ...basic, displayName: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>资产分类</Label>
            <Select value={basic.assetClassId} onValueChange={(v) => setBasic({ ...basic, assetClassId: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assetClasses.map((ac) => (
                  <SelectItem key={ac.id} value={ac.id}>
                    {ac.displayName}（{ac.id}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>资产代码</Label>
            <Input
              value={basic.assetCode}
              onChange={(e) => setBasic({ ...basic, assetCode: e.target.value.toUpperCase() })}
              placeholder="如 COMPUTE-01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>资产精度（小数位）</Label>
            <Input
              inputMode="numeric"
              value={basic.assetDecimals}
              onChange={(e) => setBasic({ ...basic, assetDecimals: e.target.value.replace(/\D/g, '').slice(0, 2) })}
              placeholder="6"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>网络（可选）</Label>
            <Select value={basic.network} onValueChange={(v) => setBasic({ ...basic, network: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不指定</SelectItem>
                <SelectItem value="tron">TRON</SelectItem>
                <SelectItem value="ethereum">Ethereum</SelectItem>
                <SelectItem value="arbitrum">Arbitrum</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>外部编号（可选）</Label>
            <Input value={basic.externalRef} onChange={(e) => setBasic({ ...basic, externalRef: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>最小下单额（人读单位）</Label>
            <Input
              inputMode="decimal"
              value={basic.minHuman}
              onChange={(e) => setBasic({ ...basic, minHuman: e.target.value })}
              placeholder="如 100"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>最大下单额（人读单位，可空）</Label>
            <Input
              inputMode="decimal"
              value={basic.maxHuman}
              onChange={(e) => setBasic({ ...basic, maxHuman: e.target.value })}
              placeholder="如 50000"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>产品简介</Label>
            <textarea
              className="min-h-[80px] w-full rounded-input border border-ink/[0.14] bg-white/70 px-3 py-2 text-sm text-ink shadow-sm placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-mint"
              value={basic.summary}
              onChange={(e) => setBasic({ ...basic, summary: e.target.value })}
              placeholder="用于投资列表展示的产品简介"
            />
          </div>
        </CardContent>
      </Card>

      {/* 利率与收益 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>利率与收益条款</CardTitle>
            <CardDescription>结构化配置利率、期限、付息方式、费率与最坏情景</CardDescription>
          </div>
          <Button size="sm" onClick={() => void saveYield()} disabled={busy === 'yield'}>
            {busy === 'yield' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存
          </Button>
        </CardHeader>
        <CardContent>
          <YieldEditor value={yieldTerms} onChange={setYieldTerms} />
        </CardContent>
      </Card>

      {/* 风险披露 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>风险披露</CardTitle>
            <CardDescription>风险等级、风险点与最坏情景说明</CardDescription>
          </div>
          <Button size="sm" onClick={() => void saveRisk()} disabled={busy === 'risk'}>
            {busy === 'risk' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>风险等级</Label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['R1', 'R2', 'R3', 'R4', 'R5'].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                    {r === 'R1' ? '（低）' : r === 'R3' ? '（中）' : r === 'R5' ? '（高）' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>最坏情景说明</Label>
            <Input value={worstCaseText} onChange={(e) => setWorstCaseText(e.target.value)} placeholder="如：极端行情下本金可能部分损失" />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>风险点（每行一条）</Label>
            <textarea
              className="min-h-[96px] w-full rounded-input border border-ink/[0.14] bg-white/70 px-3 py-2 text-sm text-ink shadow-sm placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-mint"
              value={riskItems}
              onChange={(e) => setRiskItems(e.target.value)}
              placeholder={'流动性风险：退出可能延迟\n市场风险：收益随市场波动'}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>补充说明（可选）</Label>
            <Input value={riskNotes} onChange={(e) => setRiskNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* 媒体与文件 */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>媒体与文件</CardTitle>
            <CardDescription>产品图片与附件（直传 Cloudflare R2，自动校验）</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <FolderOpen className="mr-1.5 h-4 w-4" /> 从文件库选择
            </Button>
            <StorageUpload
              bucket="rwa-assets"
              purpose="product-media"
              productId={current.id}
              label="上传图片/文件"
              accept=".pdf,.png,.jpg,.jpeg"
              size="sm"
              onDone={(object) => void addMediaRef(object.storageRef)}
              onError={(message) => setNotice({ kind: 'error', text: message })}
            />
          </div>
        </CardHeader>
        <CardContent>
          {mediaRefs.length === 0 ? (
            <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/[0.14] text-text-faint">
              <ImagePlus className="h-6 w-6 opacity-60" />
              <p className="text-sm">还没有媒体文件：可上传或从文件库选择</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {mediaRefs.map((ref) => (
                <RefPreview
                  key={ref}
                  storageRef={ref}
                  onRemove={() => void persistMedia(mediaRefs.filter((r) => r !== ref))}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 报价 */}
      <Card>
        <CardHeader>
          <CardTitle>价格与报价</CardTitle>
          <CardDescription>发布产品前必须至少有一条未来有效的报价</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-ink/[0.08]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/[0.08] text-left text-xs text-text-faint">
                  <th className="px-3 py-2 font-medium">单价</th>
                  <th className="px-3 py-2 font-medium">币种</th>
                  <th className="px-3 py-2 font-medium">来源</th>
                  <th className="px-3 py-2 font-medium">有效期至</th>
                  <th className="px-3 py-2 font-medium">录入时间</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-text-faint">
                      暂无报价
                    </td>
                  </tr>
                )}
                {quotes.map((quote) => {
                  const fresh = new Date(quote.validUntil).getTime() > Date.now()
                  return (
                    <tr key={quote.id} className="border-b border-ink/[0.05] last:border-0">
                      <td className="px-3 py-2 font-medium tabular-nums">
                        {fromAtomic(quote.unitPriceAtomicAmount, current.assetDecimals) || quote.unitPriceAtomicAmount}
                      </td>
                      <td className="px-3 py-2">{quote.currency}</td>
                      <td className="px-3 py-2 text-text-secondary">{quote.source}</td>
                      <td className="px-3 py-2">
                        <span className={fresh ? 'text-emerald-600' : 'text-amber-600'}>
                          {new Date(quote.validUntil).toLocaleString('zh-CN')}
                          {fresh ? '' : '（已过期）'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{new Date(quote.capturedAt).toLocaleString('zh-CN')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_120px_1fr_1fr_auto]">
            <div className="grid gap-1.5">
              <Label>单价（人读单位）</Label>
              <Input
                inputMode="decimal"
                value={priceForm.priceHuman}
                onChange={(e) => setPriceForm({ ...priceForm, priceHuman: e.target.value })}
                placeholder="如 1.05"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>币种</Label>
              <Select value={priceForm.currency} onValueChange={(v) => setPriceForm({ ...priceForm, currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>来源</Label>
              <Input value={priceForm.source} onChange={(e) => setPriceForm({ ...priceForm, source: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>有效期至</Label>
              <Input
                type="datetime-local"
                value={priceForm.validUntil}
                onChange={(e) => setPriceForm({ ...priceForm, validUntil: e.target.value })}
              />
            </div>
            <Button onClick={() => void addQuote()} disabled={busy === 'quote'}>
              {busy === 'quote' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}录入报价
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 披露文件 */}
      <Card>
        <CardHeader>
          <CardTitle>披露文件</CardTitle>
          <CardDescription>发行说明 / 风险披露 / 条款 / 监管文件（上传 PDF 后自动登记）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-ink/[0.08]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/[0.08] text-left text-xs text-text-faint">
                  <th className="px-3 py-2 font-medium">类型</th>
                  <th className="px-3 py-2 font-medium">语言</th>
                  <th className="px-3 py-2 font-medium">标题</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">时间</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {disclosures.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-text-faint">
                      暂无披露文件
                    </td>
                  </tr>
                )}
                {disclosures.map((d) => (
                  <tr key={d.id} className="border-b border-ink/[0.05] last:border-0">
                    <td className="px-3 py-2">
                      <Badge variant="softBlue">{DISCLOSURE_KIND_LABELS[d.kind] ?? d.kind}</Badge>
                    </td>
                    <td className="px-3 py-2">{d.locale}</td>
                    <td className="max-w-[240px] truncate px-3 py-2">{d.title}</td>
                    <td className="px-3 py-2">
                      <Badge variant={d.state === 'active' ? 'softGreen' : 'softGray'}>{d.state === 'active' ? '当前有效' : '已被替代'}</Badge>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{new Date(d.publishedAt).toLocaleString('zh-CN')}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" onClick={() => void openDisclosure(d.storageRef)}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        打开
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-[150px_120px_1fr_auto]">
            <div className="grid gap-1.5">
              <Label>类型</Label>
              <Select value={disclosureForm.kind} onValueChange={(v) => setDisclosureForm({ ...disclosureForm, kind: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DISCLOSURE_KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>语言</Label>
              <Select value={disclosureForm.locale} onValueChange={(v) => setDisclosureForm({ ...disclosureForm, locale: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      {locale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>标题（先填写，再上传文件）</Label>
              <Input
                value={disclosureForm.title}
                onChange={(e) => setDisclosureForm({ ...disclosureForm, title: e.target.value })}
                placeholder="如：风险披露说明书 v1"
              />
            </div>
            <StorageUpload
              bucket="rwa-assets"
              purpose="disclosure"
              productId={current.id}
              label="上传并登记"
              accept=".pdf"
              size="default"
              onDone={(object) => void submitDisclosure(object)}
              onError={(message) => setNotice({ kind: 'error', text: message })}
            />
          </div>
        </CardContent>
      </Card>

      <StoragePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        productId={current.id}
        onSelect={(object) => void addMediaRef(object.storageRef)}
      />
    </div>
  )
}
