'use client'

import { useState } from 'react'
import { adminApi, type AdminProduct } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function AutomaticQuoteEditor({ product, onSaved }: { product: AdminProduct; onSaved: (product: AdminProduct) => void }) {
  const binding = product.quoteBinding
  const [form, setForm] = useState({
    enabled: binding?.enabled ?? false, issuerName: binding?.issuerName ?? '', tokenName: binding?.tokenName ?? '',
    tokenSymbol: binding?.tokenSymbol ?? '', chain: binding?.chain ?? 'ethereum', contractAddress: binding?.contractAddress ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save() {
    setBusy(true); setMessage('')
    try {
      if (!/^[a-z][a-z0-9-]{1,63}$/.test(form.chain)) throw new Error('请输入有效的链标识，如 ethereum 或 arbitrum')
      const updated = await adminApi.saveAutomaticQuote(product.id, {
        ...form, expectedRevision: binding?.revision ?? 0,
      })
      onSaved(updated); setMessage('绑定已保存，等待下一轮行情校验')
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败') }
    finally { setBusy(false) }
  }
  const fields = [
    ['issuerName','已核实发行方'],['tokenName','已核实代币名称'],['tokenSymbol','代币符号'],
    ['chain','链标识（如 ethereum）'],['contractAddress','代币合约地址'],
  ] as const
  return <Card>
    <CardHeader><CardTitle>自动行情</CardTitle><CardDescription>DeFiLlama · 每 5 分钟更新 · 源数据超过 10 分钟停止申请</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key,label]) => <div key={key} className="grid gap-1.5">
        <Label htmlFor={`quote-${key}`}>{label}</Label>
        <Input id={`quote-${key}`} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} />
      </div>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} />启用已核实的代币绑定</label>
      <p className="text-xs text-text-secondary">发行方与代币名称由商务核实；行情按链、合约、符号校验。无可靠的新鲜报价时暂停申请。</p>
      {product.quoteSyncError && <p role="status" className="text-sm text-amber-700">{product.quoteSyncError==='QUOTE_PROVIDER_UNAVAILABLE'?'行情服务暂不可用':'代币身份或行情时间校验未通过'}</p>}
      {product.quoteSyncCheckedAt && <p className="text-xs text-text-secondary">最近核查：{new Date(product.quoteSyncCheckedAt).toLocaleString('zh-CN')}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <Button disabled={busy} onClick={() => void save()}>{busy?'保存中':'保存绑定'}</Button>
    </CardContent>
  </Card>
}
