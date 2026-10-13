'use client'
import { useState } from 'react'
import { adminApi, type StoredObject } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StorageUpload } from '@/components/storage-upload'
import { StoragePicker } from '@/components/storage-picker'
import { Panel, useApi } from '@/components/console/framework'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { formatAtomic, toAtomic, validateAmount } from '@/lib/money'

type Receipt = { id: string; kind: string; referenceId: string; externalReference: string; evidenceObjectId: string | null; reviewState: string; reviewNote: string | null; feeAtomic: string | null }
type Payload = { externalReference: string; evidenceRef: string; amountAtomic: string; quantityAtomic: string; feeAtomic?: string }
type Pending = { kind: 'orders' | 'redemptions'; id: string; userId: string; productName: string; amount: string; fee: string; quantity: string; externalReference: string; evidenceName: string; payload: Payload }
// Settlement cash legs are USDT with 6 decimals (backend amountAtomic / feeAtomic).
const CASH_DECIMALS = 6

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
  const [pending, setPending] = useState<Pending | null>(null)
  function reset() { setInfo(null); setAmount(''); setQuantity(''); setFee(''); setExternalReference(''); setEvidence(null) }
  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage('')
    try { await work() } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败') }
    finally { setBusy(false) }
  }
  function prepare() {
    setMessage('')
    if (!info || !evidence) return
    const amountError = validateAmount(amount, CASH_DECIMALS)
    if (amountError) { setMessage(`实际金额：${amountError}`); return }
    const quantityError = validateAmount(quantity, info.quantityDecimals)
    if (quantityError) { setMessage(`实际份额：${quantityError}`); return }
    const feeError = fee.trim() ? validateAmount(fee, CASH_DECIMALS, { allowZero: true }) : null
    if (feeError) { setMessage(`实际费用：${feeError}`); return }
    const amountAtomic = toAtomic(amount, CASH_DECIMALS)
    const quantityAtomic = toAtomic(quantity, info.quantityDecimals)
    const feeAtomic = fee.trim() ? toAtomic(fee, CASH_DECIMALS) : null
    if (feeAtomic !== null && kind === 'orders' && feeAtomic > amountAtomic) { setMessage('实际费用不能大于成交总金额'); return }
    setPending({
      kind, id: info.id, userId: info.userId, productName: info.productName,
      amount: formatAtomic(amountAtomic, CASH_DECIMALS),
      fee: feeAtomic === null ? '' : formatAtomic(feeAtomic, CASH_DECIMALS),
      quantity: formatAtomic(quantityAtomic, info.quantityDecimals),
      externalReference: externalReference.trim(),
      evidenceName: evidence.key.split('/').pop() ?? evidence.key,
      payload: {
        externalReference: externalReference.trim(), evidenceRef: evidence.storageRef,
        amountAtomic: amountAtomic.toString(), quantityAtomic: quantityAtomic.toString(),
        ...(feeAtomic !== null ? { feeAtomic: feeAtomic.toString() } : {}),
      },
    })
  }
  async function submitPending() {
    if (!pending || busy) return
    setBusy(true); setMessage('')
    try {
      await adminApi.postSettlement(pending.kind, pending.id, pending.payload)
      setMessage('已入账，等待事后复核'); reset(); receipts.reload()
    } finally { setBusy(false) }
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
        <Input aria-label="实际金额" placeholder={kind === 'orders' ? `实际成交总金额（含费用，USDT，最多 ${CASH_DECIMALS} 位小数）` : `实际到账净额（USDT，最多 ${CASH_DECIMALS} 位小数）`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        <Input aria-label="实际费用" placeholder={`其中的实际费用（USDT）${info.feeRequired ? '，必填，无费用填 0' : '，可选'}`} inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} />
        <Input aria-label="实际份额" placeholder={`凭证份额（最多 ${info.quantityDecimals} 位小数）`} inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} />
        <StorageUpload bucket="rwa-attachments" purpose="misc" label="上传成交凭证" onDone={select} />
        <Button variant="outline" onClick={() => setPicker(true)}>选择已上传凭证</Button>
        <StoragePicker open={picker} onOpenChange={setPicker} bucket="rwa-attachments" onSelect={select} />
        {evidence && <p className="text-sm">已选凭证：{evidence.key.split('/').pop()}</p>}
        <p className="text-sm">投资按本次最终成交结果完成处理，未成交金额退回可用余额；赎回份额须与申请一致。</p>
        <Button disabled={!evidence || !externalReference.trim() || !amount.trim() || !quantity.trim() || (info.feeRequired && !fee.trim())} onClick={prepare}>确认凭证并直接入账</Button>
      </>}
    </fieldset>
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => { if (!open) setPending(null) }}
      title={pending?.kind === 'redemptions' ? '确认赎回到账入账' : '确认投资成交入账'}
      description="提交后立即更新用户余额与持仓，无法撤回。请逐项核对凭证。"
      details={pending ? [
        { label: '用户', value: pending.userId, mono: true },
        { label: '产品', value: pending.productName },
        { label: '申请编号', value: pending.id, mono: true },
        { label: '资产', value: 'USDT' },
        { label: '网络', value: '—（线下凭证结算，无链上网络）' },
        { label: pending.kind === 'orders' ? '成交总金额' : '到账净额', value: `${pending.amount} USDT`, mono: true, emphasis: true },
        { label: '其中费用', value: pending.fee ? `${pending.fee} USDT` : '未填写', mono: true },
        { label: '份额', value: pending.quantity, mono: true },
        { label: '外部成交编号', value: pending.externalReference, mono: true },
        { label: '凭证', value: pending.evidenceName, mono: true },
      ] : []}
      typeToConfirm={pending?.amount}
      typeToConfirmLabel={pending ? `请输入金额 ${pending.amount} 以确认入账` : undefined}
      confirmLabel="确认入账"
      destructive
      onConfirm={submitPending}
    />
    {message && <p role="status" className="my-3 text-sm">{message}</p>}
    <div className="mt-5 space-y-3"><h3 className="font-medium">最近入账记录</h3>
      {receipts.error && <p role="alert">{receipts.error}</p>}
      {(receipts.data ?? []).map(row => <div key={row.id} className="space-y-2 rounded-xl border p-3">
        <p className="text-sm">{row.externalReference} · {row.kind === 'order' ? '投资' : '赎回'} · {row.reviewState === 'pending' ? '待复核' : row.reviewState === 'exception' ? '异常，待人工处理' : '复核通过'}</p>
        <p className="break-all text-xs">申请 {row.referenceId}</p>
        <p className="text-xs">费用：{row.feeAtomic == null ? '未记录' : `${formatAtomic(row.feeAtomic, CASH_DECIMALS)} USDT`}</p>
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
