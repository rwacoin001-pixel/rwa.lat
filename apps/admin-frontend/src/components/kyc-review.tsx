'use client'

import { useState } from 'react'
import { Panel, StatusPill, useApi } from './console/framework'

type Check = { status: 'Approved' | 'Declined'; score?: number; warnings: string[] }
type Evidence = { kind: 'hosted' | 'native'; phase?: string; requestIds: string[]; document?: Check; liveness?: Check; faceMatch?: Check }

export default function KycReview({ id, state, onDone, onClose }: { id: string; state: string; onDone: () => void; onClose: () => void }) {
  const evidence = useApi<Evidence>(`/api/admin/kyc/${encodeURIComponent(id)}/checks`)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const data = evidence.data
  const keys = ['document', 'liveness', 'faceMatch'] as const
  const labels = { document: '证件真实性', liveness: '被动活体', faceMatch: '人证比对' }
  const canApprove = data?.kind === 'native' && data.phase === 'complete' && keys.every(key => data[key]?.status === 'Approved')
  const decide = async (decision: 'approved' | 'rejected') => {
    if (busy || reason.trim().length < 2) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/kyc/${encodeURIComponent(id)}/decision`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, reasonCode: reason.trim() }) })
      const body = await response.json()
      if (!response.ok) { setError(body.message ?? body.error?.message ?? `HTTP ${response.status}`); return }
      onDone()
    } catch { setError('操作未确认，请刷新档案状态。') }
    finally { setBusy(false) }
  }
  return <Panel title="核验记录" actions={<button type="button" disabled={busy} onClick={onClose}>关闭</button>}>
    {evidence.loading ? <p>读取中…</p> : evidence.error ? <p role="alert">{evidence.error}</p> : data && <div className="space-y-4">
      {data.kind === 'native' && <div className="grid gap-3 sm:grid-cols-3">{keys.map(key => <div key={key} className="rounded-xl border border-ink/10 p-3"><b>{labels[key]}</b><div className="mt-2"><StatusPill value={data[key]?.status ?? data.phase ?? 'unknown'} /></div>{data[key]?.score !== undefined && <p className="mt-2 text-sm">分数：{data[key]?.score}</p>}{data[key]?.warnings.map(code => <p key={code} className="mt-1 break-all font-mono text-xs">{code}</p>)}</div>)}</div>}
      <div className="space-y-1"><a href="https://business.didit.me" target="_blank" rel="noopener noreferrer" className="text-sm underline">Didit 审核资料</a>{data.requestIds.map(ref => <p key={ref} className="break-all font-mono text-xs">{ref}</p>)}</div>
      {state === 'submitted' && data.kind === 'native' && <div className="space-y-3"><label className="block text-sm">复核理由<input className="mt-1 block w-full rounded-xl border border-ink/10 bg-transparent p-3" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} minLength={2} maxLength={128} /></label><div className="flex gap-3"><button type="button" className="rounded-xl border border-ink/10 px-4 py-2 disabled:opacity-40" disabled={busy || !canApprove || reason.trim().length < 2} onClick={() => void decide('approved')}>通过</button><button type="button" className="rounded-xl border border-ink/10 px-4 py-2 disabled:opacity-40" disabled={busy || reason.trim().length < 2} onClick={() => void decide('rejected')}>驳回</button></div></div>}
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
  </Panel>
}
