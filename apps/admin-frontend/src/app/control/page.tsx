'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, RefreshCw, Save, ShieldCheck, WalletCards } from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  adminApi,
  type AdminProduct,
  type AssetClass,
  type DisclosureInput,
  type OperationalSwitch,
  type PriceInput,
  type ProductInput,
  type StorageStatus,
  type TreasuryAddress,
  type TreasuryAddressInput,
} from '@/lib/admin-api'

const json = (value: unknown) => JSON.stringify(value ?? {}, null, 2)

type ProductForm = ProductInput & {
  metadataText: string
  yieldTermsText: string
  riskDisclosureText: string
  mediaRefsText: string
}

const emptyProduct: ProductForm = {
  assetClassId: '',
  externalRef: '',
  displayName: '',
  summary: '',
  assetCode: 'USD',
  assetDecimals: 6,
  network: 'ethereum',
  minOrderAtomicAmount: '',
  maxOrderAtomicAmount: '',
  metadataText: '{}',
  yieldTermsText: '{}',
  riskDisclosureText: '{}',
  mediaRefsText: '[]',
}

function formFromProduct(product: AdminProduct): ProductForm {
  return {
    assetClassId: product.assetClassId,
    externalRef: product.externalRef ?? '',
    displayName: product.displayName,
    summary: product.summary ?? '',
    assetCode: product.assetCode,
    assetDecimals: product.assetDecimals,
    network: product.network,
    minOrderAtomicAmount: product.minOrderAtomicAmount ?? '',
    maxOrderAtomicAmount: product.maxOrderAtomicAmount ?? '',
    metadataText: json(product.metadata),
    yieldTermsText: json(product.yieldTerms),
    riskDisclosureText: json(product.riskDisclosure),
    mediaRefsText: json(product.mediaRefs),
  }
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-white/80">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export default function ControlPage() {
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [switches, setSwitches] = useState<OperationalSwitch[]>([])
  const [treasuryAddresses, setTreasuryAddresses] = useState<TreasuryAddress[]>([])
  const [storage, setStorage] = useState<StorageStatus | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct)
  const [classForm, setClassForm] = useState({ id: '', displayName: '', description: '' })
  const [priceForm, setPriceForm] = useState<PriceInput>({ unitPriceAtomicAmount: '1000000', currency: 'USD', source: 'manual', validUntil: futureDate() })
  const [disclosureForm, setDisclosureForm] = useState<DisclosureInput>({ kind: 'risk_disclosure', locale: 'zh-CN', title: '', storageRef: '', contentHash: '' })
  const [walletForm, setWalletForm] = useState<TreasuryAddressInput>({ network: 'tron', assetCode: 'USDT', purpose: 'deposit', label: '', address: '', memo: '', state: 'active' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) ?? null, [products, selectedProductId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [classes, productRows, switchRows, addresses, storageStatus] = await Promise.all([
        adminApi.listAssetClasses(),
        adminApi.listProducts(),
        adminApi.listSwitches(),
        adminApi.listTreasuryAddresses(),
        adminApi.getStorageStatus(),
      ])
      setAssetClasses(classes)
      setProducts(productRows)
      setSwitches(switchRows)
      setTreasuryAddresses(addresses)
      setStorage(storageStatus)
      if (!productForm.assetClassId && classes[0]) setProductForm((current) => ({ ...current, assetClassId: classes[0].id }))
      if (selectedProductId && !productRows.some((product) => product.id === selectedProductId)) {
        setSelectedProductId('')
        setProductForm({ ...emptyProduct, assetClassId: classes[0]?.id ?? '' })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载控制台数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function selectProduct(id: string) {
    const product = products.find((row) => row.id === id)
    setSelectedProductId(id)
    if (product) setProductForm(formFromProduct(product))
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const data: ProductInput = {
        assetClassId: productForm.assetClassId,
        externalRef: productForm.externalRef || undefined,
        displayName: productForm.displayName,
        summary: productForm.summary || undefined,
        assetCode: productForm.assetCode,
        assetDecimals: Number(productForm.assetDecimals),
        network: productForm.network,
        minOrderAtomicAmount: productForm.minOrderAtomicAmount || undefined,
        maxOrderAtomicAmount: productForm.maxOrderAtomicAmount || undefined,
        metadata: parseJsonObject(productForm.metadataText, '资料参数'),
        yieldTerms: parseJsonObject(productForm.yieldTermsText, '收益参数'),
        riskDisclosure: parseJsonObject(productForm.riskDisclosureText, '风险参数'),
        mediaRefs: parseJsonArray(productForm.mediaRefsText, '媒体引用'),
      }
      const saved = selectedProductId ? await adminApi.updateProduct(selectedProductId, data) : await adminApi.createProduct(data)
      setSelectedProductId(saved.id)
      setProductForm(formFromProduct(saved))
      setNotice(selectedProductId ? '产品资料已保存' : '产品草稿已创建')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存产品失败')
    } finally {
      setSaving(false)
    }
  }

  async function addClass(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await adminApi.saveAssetClass(classForm)
      setClassForm({ id: '', displayName: '', description: '' })
      setNotice('资产分类已保存')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存资产分类失败')
    } finally {
      setSaving(false)
    }
  }

  async function publish(state: 'published' | 'suspended' | 'retired') {
    if (!selectedProductId) return
    setSaving(true)
    try {
      await adminApi.setProductState(selectedProductId, state)
      setNotice(`产品已${state === 'published' ? '发布' : state === 'suspended' ? '暂停展示' : '归档'}`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新产品状态失败')
    } finally {
      setSaving(false)
    }
  }

  async function addPrice(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedProductId) return
    setSaving(true)
    try {
      await adminApi.addPrice(selectedProductId, priceForm)
      setPriceForm((current) => ({ ...current, validUntil: futureDate() }))
      setNotice('价格报价已记录')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存价格失败')
    } finally {
      setSaving(false)
    }
  }

  async function addDisclosure(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedProductId) return
    setSaving(true)
    try {
      await adminApi.addDisclosure(selectedProductId, disclosureForm)
      setDisclosureForm((current) => ({ ...current, title: '', storageRef: '', contentHash: '' }))
      setNotice('产品资料引用已保存')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存产品资料失败')
    } finally {
      setSaving(false)
    }
  }

  async function updateSwitch(row: OperationalSwitch) {
    const enabled = !row.current?.enabled
    const reason = window.prompt(enabled ? '请输入开启原因' : '请输入暂停原因', enabled ? 'Operator-approved rollout' : 'Operator safety pause')
    if (!reason) return
    setSaving(true)
    try {
      await adminApi.updateSwitch(row.key, enabled, reason)
      setNotice(`${row.label}已${enabled ? '开启' : '暂停'}`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新运营开关失败')
    } finally {
      setSaving(false)
    }
  }

  async function saveWallet(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await adminApi.saveTreasuryAddress(walletForm)
      setWalletForm((current) => ({ ...current, label: '', address: '', memo: '' }))
      setNotice('钱包运营地址已保存')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存钱包地址失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">运营控制台</h1>
            <p className="mt-1 text-muted-foreground">产品资料、报价、风险披露、运营开关和钱包地址统一管理</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />刷新</Button>
        </div>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div> : null}
        {notice ? <div className="rounded-xl border border-mint/40 bg-mint/10 p-4 text-sm text-mint"><CheckCircle2 className="mr-2 inline h-4 w-4" />{notice}</div> : null}
        {loading ? <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">正在加载运营数据…</div> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <Card className="glass-strong">
            <CardHeader><CardTitle>产品资料管理</CardTitle><CardDescription>产品先保存为草稿；只有存在有效报价后才能发布到用户端。</CardDescription></CardHeader>
            <CardContent>
              <div className="mb-5 flex flex-wrap gap-2">
                <Button variant={selectedProductId ? 'outline' : 'secondary'} onClick={() => { setSelectedProductId(''); setProductForm({ ...emptyProduct, assetClassId: assetClasses[0]?.id ?? '' }) }}>新建草稿</Button>
                {products.map((product) => <Button key={product.id} size="sm" variant={product.id === selectedProductId ? 'default' : 'outline'} onClick={() => selectProduct(product.id)}>{product.displayName}<span className="ml-2 text-xs opacity-70">{product.state}</span></Button>)}
              </div>
              <form onSubmit={saveProduct} className="grid gap-4 md:grid-cols-2">
                <Field label="资产分类"><select className="h-10 w-full rounded-input border border-white/20 bg-black px-3" value={productForm.assetClassId} onChange={(event) => setProductForm({ ...productForm, assetClassId: event.target.value })}><option value="">请选择</option>{assetClasses.map((item) => <option key={item.id} value={item.id}>{item.displayName} ({item.id})</option>)}</select></Field>
                <Field label="产品名称"><Input required value={productForm.displayName} onChange={(event) => setProductForm({ ...productForm, displayName: event.target.value })} /></Field>
                <Field label="资产代码"><Input required value={productForm.assetCode} onChange={(event) => setProductForm({ ...productForm, assetCode: event.target.value.toUpperCase() })} /></Field>
                <Field label="小数位"><Input required type="number" min={0} max={18} value={productForm.assetDecimals} onChange={(event) => setProductForm({ ...productForm, assetDecimals: Number(event.target.value) })} /></Field>
                <Field label="网络"><select className="h-10 w-full rounded-input border border-white/20 bg-black px-3" value={productForm.network ?? ''} onChange={(event) => setProductForm({ ...productForm, network: event.target.value as ProductInput['network'] })}><option value="">不绑定网络</option><option value="tron">TRON</option><option value="ethereum">Ethereum</option><option value="arbitrum">Arbitrum</option></select></Field>
                <Field label="外部编号"><Input value={productForm.externalRef} onChange={(event) => setProductForm({ ...productForm, externalRef: event.target.value })} /></Field>
                <Field label="最小下单原子数量"><Input value={productForm.minOrderAtomicAmount} onChange={(event) => setProductForm({ ...productForm, minOrderAtomicAmount: event.target.value })} /></Field>
                <Field label="最大下单原子数量"><Input value={productForm.maxOrderAtomicAmount} onChange={(event) => setProductForm({ ...productForm, maxOrderAtomicAmount: event.target.value })} /></Field>
                <Field label="产品简介"><textarea className="min-h-24 w-full rounded-input border border-white/20 bg-transparent px-3 py-2" value={productForm.summary} onChange={(event) => setProductForm({ ...productForm, summary: event.target.value })} /></Field>
                <Field label="资料参数 JSON" hint="发行方、司法辖区、底层资产、展示标签等"><textarea className="min-h-24 w-full rounded-input border border-white/20 bg-transparent px-3 py-2 font-mono text-xs" value={productForm.metadataText} onChange={(event) => setProductForm({ ...productForm, metadataText: event.target.value })} /></Field>
                <Field label="收益说明 JSON" hint="目标收益、频率、方式、期限、锁定期、流动性"><textarea className="min-h-24 w-full rounded-input border border-white/20 bg-transparent px-3 py-2 font-mono text-xs" value={productForm.yieldTermsText} onChange={(event) => setProductForm({ ...productForm, yieldTermsText: event.target.value })} /></Field>
                <Field label="风险披露 JSON" hint="风险等级、风险因素、免责声明、适当性说明"><textarea className="min-h-24 w-full rounded-input border border-white/20 bg-transparent px-3 py-2 font-mono text-xs" value={productForm.riskDisclosureText} onChange={(event) => setProductForm({ ...productForm, riskDisclosureText: event.target.value })} /></Field>
                <Field label="图片/附件引用 JSON" hint="可先填对象存储引用；不在聊天中上传文件"><textarea className="min-h-24 w-full rounded-input border border-white/20 bg-transparent px-3 py-2 font-mono text-xs" value={productForm.mediaRefsText} onChange={(event) => setProductForm({ ...productForm, mediaRefsText: event.target.value })} /></Field>
                <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />保存产品</Button>{selectedProductId ? <><Button type="button" variant="secondary" onClick={() => void publish('published')} disabled={saving || selectedProduct?.state === 'published'}>发布</Button><Button type="button" variant="outline" onClick={() => void publish('suspended')} disabled={saving}>暂停展示</Button><Button type="button" variant="outline" onClick={() => void publish('retired')} disabled={saving}>归档</Button></> : null}</div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="glass-strong"><CardHeader><CardTitle>资产分类</CardTitle><CardDescription>分类是产品的必填归属。</CardDescription></CardHeader><CardContent><form onSubmit={addClass} className="space-y-3"><Input placeholder="分类 ID，例如 real_estate" required value={classForm.id} onChange={(event) => setClassForm({ ...classForm, id: event.target.value })} /><Input placeholder="显示名称" required value={classForm.displayName} onChange={(event) => setClassForm({ ...classForm, displayName: event.target.value })} /><Input placeholder="描述（可选）" value={classForm.description} onChange={(event) => setClassForm({ ...classForm, description: event.target.value })} /><Button type="submit" disabled={saving}>保存分类</Button></form><div className="mt-4 space-y-2">{assetClasses.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{item.displayName}<span className="ml-2 text-xs text-muted-foreground">{item.id}</span></span><Badge variant={item.state === 'active' ? 'mint' : 'secondary'}>{item.state}</Badge></div>)}</div></CardContent></Card>
            <Card className="glass-strong"><CardHeader><CardTitle>价格与披露</CardTitle><CardDescription>{selectedProduct ? `当前产品：${selectedProduct.displayName}` : '先在左侧选择或创建产品'}</CardDescription></CardHeader><CardContent className="space-y-5"><form onSubmit={addPrice} className="space-y-3"><p className="text-sm font-medium">录入报价</p><Input disabled={!selectedProductId} placeholder="原子价格，例如 1000000" required value={priceForm.unitPriceAtomicAmount} onChange={(event) => setPriceForm({ ...priceForm, unitPriceAtomicAmount: event.target.value })} /><div className="grid grid-cols-2 gap-3"><Input disabled={!selectedProductId} placeholder="USD" value={priceForm.currency} onChange={(event) => setPriceForm({ ...priceForm, currency: event.target.value.toUpperCase() })} /><Input disabled={!selectedProductId} placeholder="来源" value={priceForm.source} onChange={(event) => setPriceForm({ ...priceForm, source: event.target.value })} /></div><Input disabled={!selectedProductId} type="datetime-local" value={priceForm.validUntil} onChange={(event) => setPriceForm({ ...priceForm, validUntil: event.target.value })} /><Button type="submit" variant="secondary" disabled={!selectedProductId || saving}>保存报价</Button></form><form onSubmit={addDisclosure} className="space-y-3 border-t border-white/10 pt-5"><p className="text-sm font-medium">保存资料/附件引用</p><div className="grid grid-cols-2 gap-3"><select disabled={!selectedProductId} className="h-10 rounded-input border border-white/20 bg-black px-3" value={disclosureForm.kind} onChange={(event) => setDisclosureForm({ ...disclosureForm, kind: event.target.value as DisclosureInput['kind'] })}><option value="risk_disclosure">风险披露</option><option value="prospectus">产品说明书</option><option value="terms">条款</option><option value="regulatory">监管资料</option></select><Input disabled={!selectedProductId} placeholder="语言 zh-CN" value={disclosureForm.locale} onChange={(event) => setDisclosureForm({ ...disclosureForm, locale: event.target.value })} /></div><Input disabled={!selectedProductId} placeholder="标题" required value={disclosureForm.title} onChange={(event) => setDisclosureForm({ ...disclosureForm, title: event.target.value })} /><Input disabled={!selectedProductId} placeholder="对象存储引用或文件路径" required value={disclosureForm.storageRef} onChange={(event) => setDisclosureForm({ ...disclosureForm, storageRef: event.target.value })} /><Input disabled={!selectedProductId} placeholder="SHA-256（64位十六进制）" required value={disclosureForm.contentHash} onChange={(event) => setDisclosureForm({ ...disclosureForm, contentHash: event.target.value })} /><Button type="submit" variant="secondary" disabled={!selectedProductId || saving}>保存资料引用</Button></form></CardContent></Card>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="glass-strong"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-mint" />生产运营开关</CardTitle><CardDescription>当前真实资金环境未就绪，开启按钮会被后端拒绝；暂停始终可用。</CardDescription></CardHeader><CardContent className="space-y-3">{switches.map((row) => <div key={row.key} className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{row.label}<span className="ml-2 font-mono text-xs text-muted-foreground">{row.key}</span></p><p className="mt-1 text-sm text-muted-foreground">{row.description}</p></div><Badge variant={row.current?.enabled ? 'mint' : 'secondary'}>{row.current?.enabled ? '开启' : '关闭'}</Badge></div><div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{row.environmentReady ? '环境门禁已满足' : '环境门禁未满足'}{row.current?.reason ? ` · ${row.current.reason}` : ''}</span><Button size="sm" variant={row.current?.enabled ? 'destructive' : 'outline'} disabled={saving || (!row.current?.enabled && !row.canEnable)} onClick={() => void updateSwitch(row)}>{row.current?.enabled ? '暂停' : row.canEnable ? '开启' : '不可开启'}</Button></div></div>)}</CardContent></Card>

          <Card className="glass-strong"><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-cyan-300" />钱包运营地址</CardTitle><CardDescription>这里只保存公开地址和 Memo，不接受私钥、助记词或种子短语；当前不代表已经接入托管。</CardDescription></CardHeader><CardContent><form onSubmit={saveWallet} className="grid gap-3 md:grid-cols-2"><select className="h-10 rounded-input border border-white/20 bg-black px-3" value={walletForm.network} onChange={(event) => setWalletForm({ ...walletForm, network: event.target.value as TreasuryAddressInput['network'] })}><option value="tron">TRON</option><option value="ethereum">Ethereum</option><option value="arbitrum">Arbitrum</option></select><select className="h-10 rounded-input border border-white/20 bg-black px-3" value={walletForm.purpose} onChange={(event) => setWalletForm({ ...walletForm, purpose: event.target.value as TreasuryAddressInput['purpose'] })}><option value="deposit">充值</option><option value="withdrawal">提现</option><option value="collection">归集</option><option value="operational">运营</option></select><Input required placeholder="标签" value={walletForm.label} onChange={(event) => setWalletForm({ ...walletForm, label: event.target.value })} /><Input required placeholder="公开钱包地址" value={walletForm.address} onChange={(event) => setWalletForm({ ...walletForm, address: event.target.value })} /><Input placeholder="Memo/Tag（可选）" value={walletForm.memo} onChange={(event) => setWalletForm({ ...walletForm, memo: event.target.value })} /><Button type="submit" disabled={saving}><WalletCards className="mr-2 h-4 w-4" />保存地址</Button></form><div className="mt-5 space-y-2">{treasuryAddresses.map((row) => <div key={row.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm"><div className="flex items-center justify-between"><span>{row.label}<span className="ml-2 text-xs text-muted-foreground">{row.network}/{row.purpose}</span></span><Badge variant={row.state === 'active' ? 'mint' : 'secondary'}>{row.state}</Badge></div><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{row.address}{row.memo ? ` · Memo: ${row.memo}` : ''}</p></div>)}</div></CardContent></Card>
        </div>

        <Card className="glass-strong"><CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-amber-300" />图片与附件</CardTitle><CardDescription>{storage?.message ?? '正在读取对象存储状态'}</CardDescription></CardHeader><CardContent><div className="rounded-xl border border-dashed border-white/20 p-6 text-center text-sm text-muted-foreground"><FileUp className="mx-auto mb-3 h-8 w-8 opacity-60" /><p>后台资料字段和附件引用已就位。</p><p className="mt-1">配置 Cloudflare R2/S3、病毒扫描回调和对象存储开关后，这里再启用预签名上传；当前不会把文件伪装成已上传。</p><label className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/10 px-4 py-2 opacity-50"><FileUp className="h-4 w-4" />选择文件（等待对象存储配置）<input type="file" className="hidden" disabled /></label></div></CardContent></Card>
      </div>
    </AdminLayout>
  )
}

function futureDate() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 16)
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return parsed
  } catch {
    throw new Error(`${label}必须是合法 JSON 对象`)
  }
}

function parseJsonArray(value: string, label: string): string[] {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) throw new Error()
    return parsed
  } catch {
    throw new Error(`${label}必须是字符串数组 JSON`)
  }
}

