'use client'
import { useState } from 'react'
import { adminApi, type StoredObject } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StorageUpload } from '@/components/storage-upload'
import { StoragePicker } from '@/components/storage-picker'
import { Panel, useApi } from '@/components/console/framework'

type Receipt = { id: string; kind: string; referenceId: string; externalReference: string; evidenceObjectId: string | null; reviewState: string; reviewNote: string | null; feeAtomic: string | null }
function atomic(value: string, decimals: number, allowZero = false) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) throw new Error('请输入正数，不支持逗号或科学计数法')
  const [whole, fraction = ''] = value.trim().split('.')
  if (fraction.length > decimals) throw new Error(`小数位不能超过 ${decimals} 位`)
  const result = BigInt(whole + fraction.padEnd(decimals, '0'))
  if (!allowZero && result <= BigInt(0)) throw new Error('金额和份额必须大于零')
  return result.toString()
}
export function ManualSettlements() {
  const receipts = useApi<Receipt[]>('/api/admin/manual-settlements')
  const [kind, setKind] = useState<'orders' | 'redemptions'>('orders')
  const [id, setId] = useState('')
  const [info, setInfo] = useState<Awaited<ReturnType<typeof adminApi.settlementInfo>> | null>(null)
  const [externalReference, setExternalReference] = useState('')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('')
  const [fee, setFee] = useState('')
  const [evidence, setEvidence] = useState<StoredObject | null>(null)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [links, setLinks] = useState<Record<string, string>>({})
  function reset() { setInfo(null); setAmount(''); setQuantity(''); setFee(''); setExternalReference(''); setEvidence(null) }
  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage('')
    try { await work() } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败') }
    finally { setBusy(false) }
  }
  function select(object: StoredObject) {
    if (object.scanStatus !== 'clean') { setMessage('凭证正在校验，请稍后从文件库选择'); return }
    setEvidence(object); setPicker(false)
  }
  return <Panel title="实际成交入账与事后复核">
    <fieldset disabled={busy} className="space-y-3">
      <p className="text-sm">按实际凭证入账，提交后直接更新余额与持仓。复核异常仅作标记，由人工处理。</p>
      <select aria-label="入账类型" value={kind} onChange={e => { setKind(e.target.value as typeof kind); reset() }} className="rounded-xl border p-2"><option value="orders">投资成交</option><option value="redemptions">赎回到账</option></select>
      <Input aria-label="申请编号" placeholder="订单或赎回申请完整编号" value={id} onChange={e => { setId(e.target.value); reset() }} />
      <Button variant="outline" disabled={!id} onClick={() => void run(async () => { setInfo(null); setInfo(await adminApi.settlementInfo(kind, id.trim())) })}>查询申请</Button>
      {info && <>
        <p className="text-sm">{info.productName} · 用户 {info.userId} · {info.state}</p>
        <Input aria-label="外部成交编号" placeholder="凭证上的唯一成交编号" value={externalReference} maxLength={160} onChange={e => setExternalReference(e.target.value)} />
        <Input aria-label="实际金额" placeholder={kind === 'orders' ? '实际成交总金额（含费用，USDT）' : '实际到账净额（USDT）'} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        <Input aria-label="实际费用" placeholder={`其中的实际费用（USDT）${info.feeRequired ? '，必填，无费用填 0' : '，可选'}`} inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} />
        <Input aria-label="实际份额" placeholder={`凭证份额（最多 ${info.quantityDecimals} 位小数）`} inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} />
        <StorageUpload bucket="rwa-attachments" purpose="misc" label="上传成交凭证" onDone={select} />
        <Button variant="outline" onClick={() => setPicker(true)}>选择已上传凭证</Button>
        <StoragePicker open={picker} onOpenChange={setPicker} bucket="rwa-attachments" onSelect={select} />
        {evidence && <p className="text-sm">已选凭证：{evidence.key.split('/').pop()}</p>}
        <p className="text-sm">投资按本次最终成交结果完成处理，未成交金额退回可用余额；赎回份额须与申请一致。</p>
        <Button disabled={!evidence || !externalReference.trim() || (info.feeRequired && !fee.trim())} onClick={() => void run(async () => {
          if (!evidence) return
          await adminApi.postSettlement(kind, info.id, { externalReference: externalReference.trim(), evidenceRef: evidence.storageRef, amountAtomic: atomic(amount, 6), quantityAtomic: atomic(quantity, info.quantityDecimals), ...(fee.trim() ? { feeAtomic: atomic(fee, 6, true) } : {}) })
          setMessage('已入账，等待事后复核'); reset(); receipts.reload()
        })}>确认凭证并直接入账</Button>
      </>}
    </fieldset>
    {message && <p role="status" className="my-3 text-sm">{message}</p>}
    <div className="mt-5 space-y-3"><h3 className="font-medium">最近入账记录</h3>
      {receipts.error && <p role="alert">{receipts.error}</p>}
      {(receipts.data ?? []).map(row => <div key={row.id} className="space-y-2 rounded-xl border p-3">
        <p className="text-sm">{row.externalReference} · {row.kind === 'order' ? '投资' : '赎回'} · {row.reviewState === 'pending' ? '待复核' : row.reviewState === 'exception' ? '异常，待人工处理' : '复核通过'}</p>
        <p className="break-all text-xs">申请 {row.referenceId}</p>
        <p className="text-xs">费用：{row.feeAtomic == null ? '未记录' : `${Number(row.feeAtomic) / 1000000} USDT`}</p>
        {row.evidenceObjectId && <Button variant="outline" disabled={busy} onClick={() => void run(async () => { const result = await adminApi.downloadObject(row.evidenceObjectId!, 'inline'); setLinks(current => ({ ...current, [row.id]: result.url })) })}>获取凭证查看链接</Button>}
        {links[row.id] && <a className="text-sm underline" href={links[row.id]} target="_blank" rel="noreferrer">打开凭证（短时有效）</a>}
        {row.reviewNote && <p className="text-sm">{row.reviewNote}</p>}
        {row.reviewState === 'pending' && <>
          <Input aria-label={`复核说明 ${row.externalReference}`} placeholder="填写复核说明或异常详情" value={notes[row.id] ?? ''} onChange={e => setNotes({ ...notes, [row.id]: e.target.value })} />
          {(['verified', 'exception'] as const).map(state => <Button key={state} variant="outline" disabled={busy || !notes[row.id]?.trim()} onClick={() => void run(async () => { await adminApi.reviewSettlement(row.id, state, notes[row.id].trim()); setMessage('复核结果已记录，余额未作修改'); receipts.reload() })}>{state === 'verified' ? '复核通过' : '标记异常'}</Button>)}
        </>}
      </div>)}
    </div>
  </Panel>
}
