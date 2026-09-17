'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  adminApi,
  type AdminProduct,
  type AssetClass,
  type OperationalSwitch,
  type ProductState,
  type StorageReadiness,
  type TreasuryAddress,
} from '@/lib/admin-api'
import { describeYield, type YieldTerms } from '@/lib/yield-terms'
import { ProductEditor } from './product-editor'
import { AdminLayout } from '@/components/layout/AdminLayout'

type Tab = 'products' | 'classes' | 'switches' | 'treasury' | 'storage'

function formatAtomic(value: string, decimals: number): string {
  if (!value) return '—'
  if (!Number.isFinite(decimals) || decimals <= 0) return value
  const padded = value.padStart(decimals + 1, '0')
  const int = padded.slice(0, padded.length - decimals)
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, '')
  return frac ? `${int}.${frac}` : int
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'products', label: '产品' },
  { key: 'classes', label: '资产分类' },
  { key: 'switches', label: '运营开关' },
  { key: 'treasury', label: '财资地址' },
  { key: 'storage', label: '存储状态' },
]

const STATE_LABELS: Record<string, string> = { draft: '草稿', published: '已发布', suspended: '已暂停', retired: '已归档' }
const STATE_BADGE: Record<string, 'softGray' | 'softGreen' | 'softAmber' | 'softRed'> = {
  draft: 'softGray',
  published: 'softGreen',
  suspended: 'softAmber',
  retired: 'softRed',
}

export default function ControlPage() {
  const [tab, setTab] = useState<Tab>('products')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const [products, setProducts] = useState<AdminProduct[]>([])
  const [classes, setClasses] = useState<AssetClass[]>([])
  const [switches, setSwitches] = useState<OperationalSwitch[]>([])
  const [treasury, setTreasury] = useState<TreasuryAddress[]>([])
  const [readiness, setReadiness] = useState<StorageReadiness | null>(null)

  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ displayName: '', assetClassId: '', assetCode: '', assetDecimals: '6', summary: '' })

  const [classForm, setClassForm] = useState({ id: '', displayName: '', description: '' })

  const [switchDialog, setSwitchDialog] = useState<{ item: OperationalSwitch; enable: boolean } | null>(null)
  const [switchReason, setSwitchReason] = useState('')

  const [treasuryForm, setTreasuryForm] = useState({
    network: 'tron',
    assetCode: '',
    purpose: 'deposit',
    label: '',
    address: '',
    memo: '',
  })

  const [busy, setBusy] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, c, s, t] = await Promise.all([
        adminApi.listProducts(),
        adminApi.listAssetClasses(),
        adminApi.listSwitches().catch(() => []),
        adminApi.listTreasuryAddresses().catch(() => []),
      ])
      setProducts(p)
      setClasses(c)
      setSwitches(s)
      setTreasury(t)
      adminApi
        .getStorageReadiness()
        .then(setReadiness)
        .catch(() => setReadiness(null))
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '加载失败' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedId), [products, selectedId])

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return products.filter((p) => {
      if (stateFilter !== 'all' && p.state !== stateFilter) return false
      if (!keyword) return true
      return (
        p.displayName.toLowerCase().includes(keyword) ||
        p.assetCode.toLowerCase().includes(keyword) ||
        (p.externalRef ?? '').toLowerCase().includes(keyword)
      )
    })
  }, [products, search, stateFilter])

  const showOk = (text: string) => setNotice({ kind: 'ok', text })
  const showError = (e: unknown, fallback: string) => setNotice({ kind: 'error', text: e instanceof Error ? e.message : fallback })

  const createProduct = async () => {
    setBusy('create')
    setNotice(null)
    try {
      if (!createForm.displayName.trim()) throw new Error('请填写产品名称')
      if (!createForm.assetClassId) throw new Error('请选择资产分类')
      if (!/^[A-Z][A-Z0-9._-]{1,15}$/.test(createForm.assetCode.trim().toUpperCase())) {
        throw new Error('资产代码格式：大写字母开头，2-16 位（A-Z 0-9 . _ -）')
      }
      const decimals = Number(createForm.assetDecimals)
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('资产精度需为 0-18 的整数')
      const created = await adminApi.createProduct({
        displayName: createForm.displayName.trim(),
        assetClassId: createForm.assetClassId,
        assetCode: createForm.assetCode.trim().toUpperCase(),
        assetDecimals: decimals,
        summary: createForm.summary.trim() || undefined,
      })
      setCreateOpen(false)
      setCreateForm({ displayName: '', assetClassId: '', assetCode: '', assetDecimals: '6', summary: '' })
      await loadAll()
      setSelectedId(created.id)
      showOk('产品草稿已创建：继续完善利率、风险与报价后即可发布')
    } catch (e) {
      showError(e, '创建失败')
    } finally {
      setBusy('')
    }
  }

  const saveClass = async () => {
    setBusy('class')
    setNotice(null)
    try {
      if (!/^[a-z][a-z0-9_]{1,31}$/.test(classForm.id.trim())) throw new Error('分类 ID 格式：小写字母开头，2-32 位（a-z 0-9 _）')
      if (!classForm.displayName.trim()) throw new Error('请填写分类名称')
      await adminApi.saveAssetClass({
        id: classForm.id.trim(),
        displayName: classForm.displayName.trim(),
        description: classForm.description.trim() || undefined,
      })
      setClassForm({ id: '', displayName: '', description: '' })
      await loadAll()
      showOk('资产分类已保存')
    } catch (e) {
      showError(e, '保存失败')
    } finally {
      setBusy('')
    }
  }

  const deprecateClass = async (id: string) => {
    if (!window.confirm(`停用分类「${id}」？停用后不可再关联新产品（不影响已关联产品）。`)) return
    setBusy(`class-dep-${id}`)
    try {
      await adminApi.deprecateAssetClass(id)
      await loadAll()
      showOk('分类已停用')
    } catch (e) {
      showError(e, '停用失败')
    } finally {
      setBusy('')
    }
  }

  const submitSwitch = async () => {
    if (!switchDialog) return
    setBusy('switch')
    setNotice(null)
    try {
      if (switchReason.trim().length < 3) throw new Error('请填写变更原因（至少 3 个字符）')
      await adminApi.updateSwitch(switchDialog.item.key, switchDialog.enable, switchReason.trim())
      setSwitchDialog(null)
      setSwitchReason('')
      await loadAll()
      showOk('开关状态已更新')
    } catch (e) {
      showError(e, '开关变更失败')
    } finally {
      setBusy('')
    }
  }

  const saveTreasury = async () => {
    setBusy('treasury')
    setNotice(null)
    try {
      if (!/^[A-Z][A-Z0-9._-]{1,15}$/.test(treasuryForm.assetCode.trim().toUpperCase())) throw new Error('资产代码格式不正确')
      if (!treasuryForm.label.trim()) throw new Error('请填写地址标签')
      if (treasuryForm.address.trim().length < 8) throw new Error('请填写有效的公开地址（禁止私钥/助记词）')
      await adminApi.saveTreasuryAddress({
        network: treasuryForm.network as 'tron' | 'ethereum' | 'arbitrum',
        assetCode: treasuryForm.assetCode.trim().toUpperCase(),
        purpose: treasuryForm.purpose as 'deposit' | 'withdrawal' | 'collection' | 'operational',
        label: treasuryForm.label.trim(),
        address: treasuryForm.address.trim(),
        memo: treasuryForm.memo.trim() || undefined,
      })
      setTreasuryForm({ network: 'tron', assetCode: '', purpose: 'deposit', label: '', address: '', memo: '' })
      await loadAll()
      showOk('财资地址已保存')
    } catch (e) {
      showError(e, '保存失败')
    } finally {
      setBusy('')
    }
  }

  const deactivateTreasury = async (id: string) => {
    if (!window.confirm('停用该地址？')) return
    try {
      await adminApi.deactivateTreasuryAddress(id)
      await loadAll()
      showOk('地址已停用')
    } catch (e) {
      showError(e, '停用失败')
    }
  }

  return (
    <AdminLayout>
    <div className="space-y-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">运营控制台</h1>
          <p className="mt-1 text-sm text-muted-foreground">产品、利率、披露、开关与财资地址的统一配置中心</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'products' && !selectedProduct && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> 新建产品
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => void loadAll()} disabled={loading} title="刷新">
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

      {/* 标签页 */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key)
              setSelectedId('')
            }}
            className={`pill border px-4 py-1.5 transition-all ${
              tab === t.key
                ? 'border-mint/40 bg-mint/12 font-semibold text-mint'
                : 'border-ink/[0.12] bg-white/60 text-text-secondary hover:bg-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 产品 ── */}
      {tab === 'products' && !selectedProduct && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                <Input className="pl-9" placeholder="搜索产品名称 / 代码 / 外部编号…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="suspended">已暂停</SelectItem>
                  <SelectItem value="retired">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-text-faint">
              共 {filteredProducts.length} / {products.length} 个产品
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-text-faint" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-3 text-text-faint">
                <p className="text-sm">{products.length === 0 ? '还没有产品：点击右上角「新建产品」开始' : '没有符合筛选条件的产品'}</p>
                {products.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> 新建产品
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/[0.08] text-left text-xs text-text-faint">
                      <th className="px-5 py-3 font-medium">产品</th>
                      <th className="px-4 py-3 font-medium">分类</th>
                      <th className="px-4 py-3 font-medium">状态</th>
                      <th className="px-4 py-3 font-medium">利率摘要</th>
                      <th className="px-4 py-3 font-medium">最新报价</th>
                      <th className="px-4 py-3 font-medium">更新</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const classItem = classes.find((c) => c.id === p.assetClassId)
                      const priceFresh = p.priceValidUntil ? new Date(p.priceValidUntil).getTime() > Date.now() : false
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className="cursor-pointer border-b border-ink/[0.05] transition-colors last:border-0 hover:bg-white/60"
                        >
                          <td className="px-5 py-3">
                            <p className="font-medium">{p.displayName}</p>
                            <p className="text-xs text-text-faint">
                              {p.assetCode} · {p.assetDecimals} 位精度
                              {p.network ? ` · ${p.network}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{classItem?.displayName ?? p.assetClassId}</td>
                          <td className="px-4 py-3">
                            <Badge variant={STATE_BADGE[p.state] ?? 'softGray'}>{STATE_LABELS[p.state] ?? p.state}</Badge>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{describeYield(p.yieldTerms as YieldTerms)}</td>
                          <td className="px-4 py-3">
                            {p.latestPriceAtomicAmount ? (
                              <span className={priceFresh ? 'text-emerald-600' : 'text-amber-600'}>
                                {formatAtomic(p.latestPriceAtomicAmount, p.assetDecimals)} {p.latestPriceCurrency ?? ''}
                                {priceFresh ? '' : '（过期）'}
                              </span>
                            ) : (
                              <span className="text-text-faint">未录入</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-text-faint">{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'products' && selectedProduct && (
        <ProductEditor
          product={selectedProduct}
          assetClasses={classes}
          onBack={() => setSelectedId('')}
          onChanged={() => void adminApi.listProducts().then(setProducts).catch(() => undefined)}
        />
      )}

      {/* ── 资产分类 ── */}
      {tab === 'classes' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>资产分类</CardTitle>
              <CardDescription>四类资产之上的一级分类（如 AI 算力、RWA、股票、预测市场）</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {classes.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-text-faint">还没有资产分类：先在右侧创建</p>
              ) : (
                <div className="divide-y divide-ink/[0.05]">
                  {classes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{c.displayName}</p>
                          <Badge variant={c.state === 'active' ? 'softGreen' : 'softGray'}>{c.state === 'active' ? '启用中' : '已停用'}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-text-faint">
                          {c.id}
                          {c.description ? ` · ${c.description}` : ''}
                        </p>
                      </div>
                      {c.state === 'active' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-negative"
                          onClick={() => void deprecateClass(c.id)}
                          disabled={busy === `class-dep-${c.id}`}
                        >
                          停用
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setClassForm({ id: c.id, displayName: c.displayName, description: c.description ?? '' })}
                        >
                          恢复
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>新建 / 恢复分类</CardTitle>
              <CardDescription>同 ID 保存即恢复为启用状态</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1.5">
                <Label>分类 ID（英文小写）</Label>
                <Input
                  value={classForm.id}
                  onChange={(e) => setClassForm({ ...classForm, id: e.target.value.toLowerCase() })}
                  placeholder="ai_compute"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>显示名称</Label>
                <Input
                  value={classForm.displayName}
                  onChange={(e) => setClassForm({ ...classForm, displayName: e.target.value })}
                  placeholder="AI 算力"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>描述（可选）</Label>
                <Input value={classForm.description} onChange={(e) => setClassForm({ ...classForm, description: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => void saveClass()} disabled={busy === 'class'}>
                {busy === 'class' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存分类
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 运营开关 ── */}
      {tab === 'switches' && (
        <div className="grid gap-4 md:grid-cols-2">
          {switches.length === 0 && (
            <Card className="md:col-span-2">
              <CardContent className="py-10 text-center text-sm text-text-faint">暂无可显示的运营开关（或本账号权限不足）</CardContent>
            </Card>
          )}
          {switches.map((item) => {
            const enabled = item.current?.enabled ?? false
            return (
              <Card key={item.key}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                      <p className="mt-1 font-mono text-[11px] text-text-faint">{item.key}</p>
                    </div>
                    <Badge variant={enabled ? 'softGreen' : 'softGray'}>{enabled ? '已启用' : '已停用'}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={item.environmentReady ? 'softBlue' : 'softAmber'}>
                      {item.environmentReady ? '环境门禁就绪' : '环境门禁未开放'}
                    </Badge>
                    {item.current?.reason && <span className="text-text-faint">最近原因：{item.current.reason}</span>}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant={enabled ? 'outline' : 'default'}
                      disabled={!enabled && !item.canEnable}
                      onClick={() => {
                        setSwitchDialog({ item, enable: !enabled })
                        setSwitchReason('')
                      }}
                    >
                      {enabled ? '停用' : '启用'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          <Card className="md:col-span-2 border-amber-200 bg-amber-50/60">
            <CardContent className="flex items-start gap-2 p-4 text-sm text-amber-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                运营开关不是绕过环境门禁的按钮：真实资金相关能力仍受 Core 环境变量约束（当前生产为关闭状态，符合既定安全设计）。
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 财资地址 ── */}
      {tab === 'treasury' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle>公开财资地址</CardTitle>
              <CardDescription>仅保存公开地址；系统拒绝任何私钥 / 助记词 / 种子短语</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {treasury.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-text-faint">还没有财资地址</p>
              ) : (
                <div className="divide-y divide-ink/[0.05]">
                  {treasury.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="softBlue">{t.network}</Badge>
                          <Badge variant="softGray">{t.purpose}</Badge>
                          <p className="font-medium">{t.label}</p>
                          {t.state !== 'active' && <Badge variant="softRed">已停用</Badge>}
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-text-secondary">{t.address}</p>
                      </div>
                      {t.state === 'active' && (
                        <Button variant="ghost" size="sm" className="text-negative" onClick={() => void deactivateTreasury(t.id)}>
                          停用
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-mint" /> 添加地址
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>网络</Label>
                  <Select value={treasuryForm.network} onValueChange={(v) => setTreasuryForm({ ...treasuryForm, network: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tron">TRON</SelectItem>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>用途</Label>
                  <Select value={treasuryForm.purpose} onValueChange={(v) => setTreasuryForm({ ...treasuryForm, purpose: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">充值</SelectItem>
                      <SelectItem value="withdrawal">提现</SelectItem>
                      <SelectItem value="collection">归集</SelectItem>
                      <SelectItem value="operational">运营</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>资产代码</Label>
                <Input
                  value={treasuryForm.assetCode}
                  onChange={(e) => setTreasuryForm({ ...treasuryForm, assetCode: e.target.value.toUpperCase() })}
                  placeholder="USDT"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>标签</Label>
                <Input value={treasuryForm.label} onChange={(e) => setTreasuryForm({ ...treasuryForm, label: e.target.value })} placeholder="主充值地址" />
              </div>
              <div className="grid gap-1.5">
                <Label>公开地址</Label>
                <Input
                  value={treasuryForm.address}
                  onChange={(e) => setTreasuryForm({ ...treasuryForm, address: e.target.value })}
                  placeholder="T… / 0x…"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>备注（可选）</Label>
                <Input value={treasuryForm.memo} onChange={(e) => setTreasuryForm({ ...treasuryForm, memo: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => void saveTreasury()} disabled={busy === 'treasury'}>
                {busy === 'treasury' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存地址
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 存储状态 ── */}
      {tab === 'storage' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-mint" /> 对象存储（文件上传）
              </CardTitle>
              <CardDescription>产品媒体与披露文件使用的存储服务</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {readiness ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={readiness.enabled ? 'softGreen' : 'softAmber'}>{readiness.enabled ? '已启用' : '未启用'}</Badge>
                    <Badge variant="softBlue">{readiness.scanMode === 'internal-basic' ? '内置基础扫描' : '外部扫描服务'}</Badge>
                  </div>
                  <p className="text-sm text-text-secondary">{readiness.message}</p>
                  <div className="rounded-2xl border border-ink/[0.08] divide-y divide-ink/[0.05]">
                    {readiness.buckets.map((b) => (
                      <div key={b.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{b.label}</p>
                          <p className="font-mono text-xs text-text-faint">{b.name}</p>
                        </div>
                        <p className="text-xs text-text-faint">
                          最大 {(b.maxBytes / 1024 / 1024).toFixed(0)} MB · {b.contentTypes.map((t) => t.split('/')[1]).join('/')}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-faint">无法读取存储状态（请确认后端已部署最新版本）</p>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link href="/files">前往文件管理</Link>
              </Button>
            </CardContent>
          </Card>
          {readiness && !readiness.enabled && (
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="space-y-2 p-5 text-sm text-amber-800">
                <p className="font-medium">启用步骤（管理员操作）</p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>在 Cloudflare R2 创建桶：rwa-assets / rwa-kyc / rwa-attachments</li>
                  <li>创建 R2 API Token（对象读写）并保存 Key</li>
                  <li>在 Render 服务（rwa-lat-admin）设置环境变量：OBJECT_STORAGE_ENABLED=true、S3_REGION=auto、S3_ENDPOINT、S3_ACCESS_KEY、S3_SECRET_KEY、OBJECT_STORAGE_SCAN_MODE=internal-basic</li>
                  <li>保存后等待服务重新部署，再回到本页刷新</li>
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 新建产品弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建产品草稿</DialogTitle>
            <DialogDescription>先创建草稿，再完善利率、风险、媒体和报价后发布</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>产品名称</Label>
              <Input
                value={createForm.displayName}
                onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                placeholder="如：AI 算力份额 · 北美集群 A"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>资产分类</Label>
                <Select value={createForm.assetClassId} onValueChange={(v) => setCreateForm({ ...createForm, assetClassId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes
                      .filter((c) => c.state === 'active')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.displayName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>资产代码</Label>
                <Input
                  value={createForm.assetCode}
                  onChange={(e) => setCreateForm({ ...createForm, assetCode: e.target.value.toUpperCase() })}
                  placeholder="GPU-A1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>资产精度（小数位）</Label>
                <Input
                  inputMode="numeric"
                  value={createForm.assetDecimals}
                  onChange={(e) => setCreateForm({ ...createForm, assetDecimals: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>简介（可选）</Label>
              <Input value={createForm.summary} onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void createProduct()} disabled={busy === 'create'}>
              {busy === 'create' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}创建草稿
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 开关变更弹窗 */}
      <Dialog open={Boolean(switchDialog)} onOpenChange={(open) => !open && setSwitchDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {switchDialog?.enable ? '启用' : '停用'}「{switchDialog?.item.label}」
            </DialogTitle>
            <DialogDescription>该操作会记入审计日志，请如实填写原因</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>变更原因（≥3 个字符）</Label>
            <Input value={switchReason} onChange={(e) => setSwitchReason(e.target.value)} placeholder="例如：运营演练 / 暂停受理" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSwitchDialog(null)}>
              取消
            </Button>
            <Button onClick={() => void submitSwitch()} disabled={busy === 'switch'}>
              {busy === 'switch' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  )
}
