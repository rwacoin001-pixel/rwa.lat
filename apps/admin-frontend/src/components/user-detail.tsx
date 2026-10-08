'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime, StatusPill, useApi } from '@/components/console/framework'
import { formatUsdt, previewAdjustment, type AdjustmentBody, type AdjustmentMode } from '@/lib/user-balances'

export type ManagedUser = {
  id: string; status: string; locale: string; created_at: string; updated_at: string
  email: string | null; emailState: string; displayName: string | null; handle: string | null
  loginMethods: string[]; lastSeenAt: string | null; availableAtomic: string | null; lockedAtomic: string | null; balanceAdjustable: boolean
}
type UserDetail = {
  user: ManagedUser; singleOperatorEnabled: boolean; nextCursor: string | null
  adjustments: Array<{ id: string; state: string; mode: string | null; reason: string | null; reasonCode: string; atomicAmount: string;
    beforeAtomic: string | null; afterAtomic: string | null; requestedBy: string; createdAt: string; ledgerTransactionId: string | null }>
  transactions: Array<{ id: string; transactionType: string; effectiveAt: string;
    entries: Array<{ purpose: string; side: string; normalSide: string; atomicAmount: string; assetCode: string; assetDecimals: number }> }>
}
type Prepared = { body: AdjustmentBody; preview: ReturnType<typeof previewAdjustment> }
const modeNames = { credit: '手工充值', debit: '扣减余额', set: '设置余额' }
const field = 'h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-ink/50 disabled:opacity-60'
const primary = 'rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white disabled:opacity-40'

export function UserDetailDialog({ id, actorId, canAdjust, onClose, onChanged }: { id: string; actorId: string; canAdjust: boolean; onClose: () => void; onChanged: () => void }) {
  const detail = useApi<UserDetail>(`/api/admin/users/${encodeURIComponent(id)}`)
  const [mode, setMode] = useState<AdjustmentMode>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [restored, setRestored] = useState(false)
  const submitting = useRef(false)
  const storageKey = `rwa-admin-adjustment:${actorId}:${id}`
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) {
        const pending = JSON.parse(saved) as Prepared
        const preview = previewAdjustment(pending.body.mode, pending.body.amount, pending.body.expectedAtomicBalance, pending.body.reason)
        if (!/^[0-9a-f-]{36}$/i.test(pending.body.operationId)) throw new Error('操作编号无效')
        setPrepared({ body: pending.body, preview }); setUncertain(true)
        setError('存在尚未确认的操作，请重试本笔操作查询结果。')
      }
      setRestored(true)
    } catch { setError('无法读取待确认操作，请勿提交新调整，先核对账本流水。') }
  }, [storageKey])
  const user = detail.data?.user
  const available = Boolean(restored && user?.balanceAdjustable && detail.data?.singleOperatorEnabled && canAdjust && !detail.loading && !detail.error)

  function prepare() {
    if (!user || !available) return
    try {
      const preview = previewAdjustment(mode, amount.trim(), user.availableAtomic, reason)
      setPrepared({ preview, body: { operationId: crypto.randomUUID(), mode, amount: amount.trim(), reason: reason.trim(), expectedAtomicBalance: preview.before } })
      setError(''); setSuccess('')
    } catch (e) { setError(e instanceof Error ? e.message : '请核对金额。') }
  }
  async function submit() {
    if (!prepared || submitting.current || !canAdjust) return
    submitting.current = true; setBusy(true); setError('')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 35_000)
    let submitted = false
    try {
      // Persist before submission, so a page refresh cannot accidentally create a second credit.
      sessionStorage.setItem(storageKey, JSON.stringify(prepared))
      submitted = true
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/balance-adjustments`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prepared.body), signal: controller.signal,
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        const upstream = result?.upstreamStatus ?? response.status
        if (uncertain || upstream >= 500) throw new Error(result?.message ?? '连接中断，尚未确认结果。请重试本笔操作，请勿另建调整。')
        sessionStorage.removeItem(storageKey)
        setUncertain(false); setPrepared(null); detail.reload(); onChanged()
        setError(result?.message ?? `提交失败 (${response.status})`)
        return
      }
      if (result?.state !== 'posted' || typeof result?.afterAtomic !== 'string') throw new Error('尚未确认入账结果，请重试本笔操作。')
      sessionStorage.removeItem(storageKey)
      setSuccess(`已入账 · 可用余额 ${formatUsdt(result.afterAtomic)} USDT`)
      setPrepared(null); setUncertain(false); setAmount(''); setReason(''); detail.reload(); onChanged()
    } catch (e) {
      setUncertain(submitted)
      setError(!submitted ? '无法保存操作编号，未提交调整。请检查浏览器存储权限。' : e instanceof Error && e.name !== 'AbortError' ? e.message : '请求超时，尚未确认结果。请重试本笔操作。')
    } finally { clearTimeout(timeout); submitting.current = false; setBusy(false) }
  }
  const closeBlocked = busy || uncertain
  return <Dialog open onOpenChange={(open) => { if (!open && !closeBlocked) onClose() }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto" style={{ animation: 'none' }} onEscapeKeyDown={(event) => { if (closeBlocked) event.preventDefault() }} onInteractOutside={(event) => { if (closeBlocked) event.preventDefault() }}>
      <DialogTitle>用户详情</DialogTitle><DialogDescription className="break-all text-xs text-text-faint">{id}</DialogDescription>
      {detail.loading && <p role="status">正在读取用户与账本…</p>}
      {detail.error && <div role="alert" className="text-sm text-red-700">{detail.error}<button className="ml-3 underline" onClick={detail.reload}>重试</button></div>}
      {user && !detail.error && <>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="break-all font-medium">{user.email ?? (user.emailState === 'unavailable' ? '邮箱读取失败' : '未绑定邮箱')}</p><p className="mt-1 text-sm text-text-faint">{user.displayName || '未设置昵称'}{user.handle ? ` · @${user.handle}` : ''}</p></div><StatusPill value={user.status} /></div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-ink/[0.04] p-4"><div><p className="text-xs text-text-faint">可用 USDT</p><p className="mt-1 break-all text-xl font-semibold tabular-nums">{formatUsdt(user.availableAtomic)}</p></div><div><p className="text-xs text-text-faint">锁定 USDT</p><p className="mt-1 break-all text-xl font-semibold tabular-nums">{formatUsdt(user.lockedAtomic)}</p></div></div>
        <dl className="grid grid-cols-2 gap-2 text-xs text-text-secondary"><div><dt>登录方式</dt><dd className="mt-1">{user.loginMethods.map(loginMethodName).join(' / ') || '—'}</dd></div><div><dt>邮箱验证</dt><dd className="mt-1">{emailStateName(user.emailState)}</dd></div><div><dt>注册时间</dt><dd className="mt-1">{formatDateTime(user.created_at)}</dd></div><div><dt>最近活跃</dt><dd className="mt-1">{user.lastSeenAt ? formatDateTime(user.lastSeenAt) : '—'}</dd></div><div><dt>语言</dt><dd className="mt-1">{user.locale}</dd></div></dl>
        <section className="border-t border-ink/10 pt-4"><h3 className="mb-3 font-semibold" title="手工调整站内账本余额，不代表链上到账。">USDT 调账</h3>
          {!canAdjust ? <p className="text-sm text-text-faint">当前管理员没有调账权限。</p>
            : prepared ? <div className="space-y-3 rounded-2xl border border-ink/15 p-4">
              <p className="text-sm font-semibold">核对 {modeNames[prepared.body.mode]}</p><p className="break-all text-xs">{user.email || id}</p>
              <div className="grid grid-cols-3 gap-2 text-xs"><div>调整前<p className="mt-1 font-semibold tabular-nums">{formatUsdt(prepared.preview.before)}</p></div><div>差额<p className="mt-1 font-semibold tabular-nums">{BigInt(prepared.preview.delta) > BigInt(0) ? '+' : ''}{formatUsdt(prepared.preview.delta)}</p></div><div>调整后<p className="mt-1 font-semibold tabular-nums">{formatUsdt(prepared.preview.after)}</p></div></div>
              <p className="break-words text-sm">原因：{prepared.body.reason}</p><div className="flex justify-end gap-2"><button type="button" className="px-4 text-sm disabled:opacity-40" disabled={closeBlocked} onClick={() => setPrepared(null)}>返回修改</button><button type="button" className={primary} disabled={busy} onClick={submit}>{busy ? '正在入账…' : uncertain ? '重试本笔操作' : '确认入账'}</button></div>
            </div> : !detail.data?.singleOperatorEnabled ? <p className="text-sm text-text-faint">尚未启用单人调账。</p>
              : !user.balanceAdjustable ? <p className="text-sm text-text-faint">此用户或可用账户暂不可调账。</p>
                : <form onSubmit={(event) => { event.preventDefault(); prepare() }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-xs"><span>操作</span><select className={field} value={mode} disabled={!available} onChange={(e) => setMode(e.target.value as AdjustmentMode)}>{Object.entries(modeNames).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label><label className="space-y-1 text-xs"><span>{mode === 'set' ? '目标可用余额' : '金额'} · USDT</span><input className={field} inputMode="decimal" autoComplete="off" placeholder="0.00" maxLength={79} value={amount} disabled={!available} onChange={(e) => setAmount(e.target.value)} /></label></div>
                  <label className="block space-y-1 text-xs"><span>调整原因</span><input className={field} value={reason} maxLength={240} required disabled={!available} onChange={(e) => setReason(e.target.value)} /></label><div className="flex justify-end"><button type="submit" className={primary} disabled={!available}>核对金额</button></div>
                </form>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="mt-3 text-sm text-emerald-700">{success}</p>}
        </section>
        <section className="border-t border-ink/10 pt-4"><h3 className="mb-3 font-semibold">最近调账</h3>{detail.data?.adjustments.length === 0 && <p className="text-sm text-text-faint">暂无调账</p>}
          <div className="space-y-2">{detail.data?.adjustments.map((a) => <div key={a.id} className="rounded-xl bg-ink/[0.03] p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span>{modeNames[a.mode as AdjustmentMode] || a.reasonCode} · {a.state === 'posted' ? '已入账' : a.state}</span><span>{formatDateTime(a.createdAt)}</span></div><p className="mt-1 tabular-nums">{a.beforeAtomic !== null && a.afterAtomic !== null ? `${formatUsdt(a.beforeAtomic)} → ${formatUsdt(a.afterAtomic)} USDT` : `${formatUsdt(a.atomicAmount)} USDT`}</p><p className="mt-1 break-words text-text-secondary">{a.reason || a.reasonCode}</p><p className="mt-1 break-all font-mono text-[10px] text-text-faint">操作人 {a.requestedBy}<br />流水 {a.ledgerTransactionId || '—'}</p></div>)}</div>
        </section>
        <section className="border-t border-ink/10 pt-4"><h3 className="mb-3 font-semibold">最近账本流水</h3>{detail.data?.transactions.length === 0 && <p className="text-sm text-text-faint">暂无流水</p>}
          <div className="space-y-2">{detail.data?.transactions.map((t) => <div key={t.id} className="rounded-xl bg-ink/[0.03] p-3 text-xs"><div className="flex justify-between gap-2"><span>{t.transactionType}</span><span>{formatDateTime(t.effectiveAt)}</span></div>{t.entries.map((e, index) => <p key={index} className="mt-1 tabular-nums">{e.purpose} · {e.side === e.normalSide ? '+' : '−'}{e.assetDecimals === 6 ? formatUsdt(e.atomicAmount) : `${e.atomicAmount} 原子单位`} {e.assetCode}</p>)}<p className="mt-1 break-all font-mono text-[10px] text-text-faint">{t.id}</p></div>)}</div>{detail.data?.nextCursor && <p className="mt-2 text-xs text-text-faint">显示最近 20 笔；完整流水见账本页面。</p>}
        </section>
      </>}
    </DialogContent>
  </Dialog>
}
export function loginMethodName(value: string) { return ({ email: '邮箱', google: 'Google', github: 'GitHub', x: 'X', external_wallet: '钱包', passkey: 'Passkey' } as Record<string, string>)[value] || value }
export function emailStateName(value: string) { return ({ verified: '已验证', pending: '未验证', none: '未绑定', unavailable: '读取失败' } as Record<string, string>)[value] || value }
