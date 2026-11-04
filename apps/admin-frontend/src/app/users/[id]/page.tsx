'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/ops/AppShell'
import { usePolled, usePolledList } from '@/components/ops/data'
import { ago, money, networkLabel, sgTime, shortAddress } from '@/components/ops/format'
import { BigStatCard, Board, Chip, CircleButton, Face, Money, Notice, PageTitle, SideCard, Updated, WhiteButton } from '@/components/ops/ui'
import { useAdminProfile } from '@/components/rbac-gate'
import { UserDetailDialog, emailStateName, loginMethodName, type ManagedUser } from '@/components/user-detail'

type Detail = {
  user: ManagedUser; singleOperatorEnabled: boolean; nextCursor: string | null
  adjustments: Array<{ id: string; state: string; mode: string | null; reason: string | null; reasonCode: string; atomicAmount: string; beforeAtomic: string | null; afterAtomic: string | null; requestedBy: string; createdAt: string; ledgerTransactionId: string | null }>
  transactions: Array<{ id: string; transactionType: string; effectiveAt: string; entries: Array<{ purpose: string; side: string; normalSide: string; atomicAmount: string; assetCode: string; assetDecimals: number }> }>
}
type Withdrawal = { id: string; userId: string; network: string; atomicAmount: string; destination: string; state: string; requestedAt: string }
type Kyc = { id: string; userId: string; state: string; provider: string; reasonCode: string | null; submittedAt: string | null; decidedAt: string | null; createdAt: string }
type Audit = { id: string; occurredAt: string; actorType: string; action: string; objectType: string; objectId: string | null; reasonCode: string | null }

const STATUS: Record<string, string> = { active: '正常', restricted: '受限', suspended: '暂停', closed: '已关闭' }
const TX: Record<string, string> = { deposit: '充值', withdrawal: '提现', withdrawal_fee: '提现手续费', internal_transfer: '转账', referral_reward: '推荐奖励', quant_subscription: '量化申购', quant_redemption: '量化赎回', quant_payout: '量化收益', prediction_bet: '预测下单', prediction_payout: '预测赔付', manual_adjustment: '调账', reversal: '冲正', yield_distribution: '收益发放' }
const W_STATE: Record<string, string> = { risk_review: '待审', approved: '待执行', signing: '签名中', broadcast: '已广播', confirming: '确认中', completed: '已到账', rejected: '已拒绝', failed: '失败', cancelled: '已取消' }
const K_STATE: Record<string, string> = { submitted: '待审', approved: '已通过', rejected: '已驳回', expired: '已过期', not_started: '未开始' }
const ADJ: Record<string, string> = { credit: '手工充值', debit: '扣减余额', set: '设置余额' }
const TABS = ['ledger', 'withdrawals', 'kyc', 'adjustments', 'audit'] as const

function Profile() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? params.get('tab')! : 'ledger'
  const detail = usePolled<Detail>(`/api/admin/users/${encodeURIComponent(id)}`, 0)
  const withdrawals = usePolledList<Withdrawal>(tab === 'withdrawals' ? '/api/admin/wallet/withdrawals?limit=200' : null, 0)
  const kyc = usePolledList<Kyc>(tab === 'kyc' ? '/api/admin/console/kyc?limit=200' : null, 0)
  const audit = usePolledList<Audit>(tab === 'audit' ? `/api/admin/audit?userId=${encodeURIComponent(id)}&limit=100` : null, 0)
  const access = useAdminProfile()
  const canAdjust = ['users.read', 'ledger.adjustments.manage', 'ledger.adjustments.post'].every((p) => access.profile?.permissions.includes(p))
  const [adjusting, setAdjusting] = useState(false)
  const [copied, setCopied] = useState(false)
  const u = detail.data?.user
  const days = u ? Math.floor((Date.now() - Date.parse(u.created_at)) / 86400000) : null
  const myWithdrawals = (withdrawals.data ?? []).filter((w) => w.userId === id)
  const myKyc = (kyc.data ?? []).filter((k) => k.userId === id)
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false })

  return (
    <>
      <PageTitle back="/users" title={u?.email ?? (u ? '未绑定邮箱' : '用户')}
        meta={<span className="flex flex-wrap items-center gap-x-3">{u && <><span>{u.displayName || '未设置昵称'}{u.handle ? ` · @${u.handle}` : ''}</span><Chip tone={u.status === 'active' ? 'plain' : u.status === 'closed' ? 'down' : 'warn'}>{STATUS[u.status] ?? u.status}</Chip></>}<Updated at={detail.updatedAt} loading={detail.loading} /></span>}
        actions={<button type="button" onClick={() => { void navigator.clipboard.writeText(id); setCopied(true) }} className="flex h-10 items-center gap-2 rounded-full border border-ops-line px-4 font-mono text-[12px] text-ops-muted hover:bg-ops-raised">{copied ? <Check className="h-4 w-4 text-ops-lime" /> : <Copy className="h-4 w-4" />}{shortAddress(id, 8, 6)}</button>} />
      {detail.error && <Notice kind="error">{detail.error}</Notice>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <BigStatCard stats={[
          { label: '可用 USDT', value: <Money atomic={u?.availableAtomic ?? null} /> },
          { label: '锁定 USDT', value: <Money atomic={u?.lockedAtomic ?? null} />, hint: '提现中、下单中等' },
          { label: '注册', value: days === null ? '—' : <>{days}<span className="ml-1 text-[0.5em] text-ops-muted">天</span></>, hint: u?.lastSeenAt ? `最近活跃 ${ago(u.lastSeenAt)}` : '没有活跃记录' },
        ]}>
          {u && <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ops-muted">
            <Face id={id} size={36} />
            <span>登录：{u.loginMethods.map(loginMethodName).join(' / ') || '—'}</span>
            <span>邮箱：{emailStateName(u.emailState)}</span>
            <span>语言：{u.locale}</span>
            <span title={sgTime(u.created_at)}>注册于 {sgTime(u.created_at).slice(0, 10)}</span>
          </div>}
        </BigStatCard>
        <SideCard label="调整站内余额" value="调账"
          action={<WhiteButton disabled={!u || !canAdjust || !access.profile} onClick={() => setAdjusting(true)}>{canAdjust ? '开始调账' : '没有调账权限'}</WhiteButton>}>
          <p className="mt-3 text-[13px] text-ops-muted">只改站内账本，不代表链上到账。每一笔都要核对金额和原因，提交后不能撤回。</p>
        </SideCard>
      </div>

      <div className="h-10" />
      <Board tabs={[{ key: 'ledger', label: '流水' }, { key: 'withdrawals', label: '提现' }, { key: 'kyc', label: 'KYC' }, { key: 'adjustments', label: '调账', count: detail.data?.adjustments.length }, { key: 'audit', label: '操作记录' }]} active={tab} onTab={setTab}
        title={{ ledger: '最近账本流水', withdrawals: '提现', kyc: 'KYC 档案', adjustments: '调账记录', audit: '操作记录' }[tab]}>
        {tab === 'ledger' && (
          <ul className="flex flex-col">
            {(detail.data?.transactions ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 border-b border-ops-rule px-3 py-3 last:border-0">
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{TX[t.transactionType] ?? t.transactionType}</span><span className="block font-mono text-[11px] text-ops-sub">{shortAddress(t.id, 8, 6)}</span></span>
                <span className="text-right text-[13px] tabular-nums">{t.entries.map((e, i) => <span key={i} className={cn('block', e.side === e.normalSide ? 'text-[#0F7A4A]' : 'text-[#C23B33]')}>{e.side === e.normalSide ? '+' : '−'}{e.assetDecimals === 6 ? money(e.atomicAmount) : e.atomicAmount} {e.assetCode} <span className="text-ops-sub">· {e.purpose}</span></span>)}</span>
                <span className="w-[120px] text-right text-[12px] text-ops-sub" title={sgTime(t.effectiveAt)}>{ago(t.effectiveAt)}</span>
              </li>
            ))}
            {detail.data && !detail.data.transactions.length && <li className="px-4 py-10 text-center text-[14px] text-ops-sub">没有流水。</li>}
            {detail.data?.nextCursor && <li className="px-3 pt-3 text-[12px] text-ops-sub">只显示最近 20 笔。</li>}
          </ul>
        )}
        {tab === 'withdrawals' && (
          <ul className="flex flex-col">
            {myWithdrawals.map((w) => (
              <li key={w.id} className="border-b border-ops-rule last:border-0">
                <Link href={`/funds/withdrawals?view=all&id=${w.id}`} className="flex items-center gap-3 rounded-[20px] px-3 py-3 hover:bg-[#F4F5F7]">
                  <span className="min-w-0 flex-1"><span className="block font-mono text-[13px]">{shortAddress(w.destination, 8, 6)}</span><span className="block text-[12px] text-ops-sub">{networkLabel(w.network)} · {ago(w.requestedAt)}</span></span>
                  <Chip tone={w.state === 'risk_review' ? 'warn' : w.state === 'completed' ? 'up' : w.state === 'rejected' || w.state === 'failed' ? 'down' : 'plain'}>{W_STATE[w.state] ?? w.state}</Chip>
                  <Money atomic={w.atomicAmount} unit="USDT" className="w-[150px] text-right text-[15px]" />
                </Link>
              </li>
            ))}
            {withdrawals.data && !myWithdrawals.length && <li className="px-4 py-10 text-center text-[14px] text-ops-sub">最近 200 笔提现里没有这个用户的。</li>}
            {withdrawals.loading && <li className="px-4 py-10 text-center text-[14px] text-ops-sub">读取中…</li>}
          </ul>
        )}
        {tab === 'kyc' && (
          <ul className="flex flex-col">
            {myKyc.map((k) => (
              <li key={k.id} className="border-b border-ops-rule last:border-0">
                <Link href={`/kyc?view=all&id=${k.id}`} className="flex items-center gap-3 rounded-[20px] px-3 py-3 hover:bg-[#F4F5F7]">
                  <span className="min-w-0 flex-1"><span className="block font-mono text-[13px]">{shortAddress(k.id, 8, 6)}</span><span className="block text-[12px] text-ops-sub">{k.provider} · {ago(k.submittedAt ?? k.createdAt)}{k.reasonCode ? ` · ${k.reasonCode}` : ''}</span></span>
                  <Chip tone={k.state === 'submitted' ? 'warn' : k.state === 'approved' ? 'up' : k.state === 'rejected' ? 'down' : 'plain'}>{K_STATE[k.state] ?? k.state}</Chip>
                </Link>
              </li>
            ))}
            {kyc.data && !myKyc.length && <li className="px-4 py-10 text-center text-[14px] text-ops-sub">没有 KYC 档案。</li>}
          </ul>
        )}
        {tab === 'adjustments' && (
          <ul className="flex flex-col">
            {(detail.data?.adjustments ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-ops-rule px-3 py-3 last:border-0">
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{ADJ[a.mode ?? ''] ?? a.reasonCode} · {a.state === 'posted' ? '已入账' : a.state}</span><span className="block text-[12px] text-ops-sub">{a.reason || a.reasonCode} · 操作人 {shortAddress(a.requestedBy, 6, 4)}</span></span>
                <span className="text-right text-[13px] tabular-nums">{a.beforeAtomic !== null && a.afterAtomic !== null ? `${money(a.beforeAtomic)} → ${money(a.afterAtomic)}` : money(a.atomicAmount)} USDT</span>
                <span className="w-[120px] text-right text-[12px] text-ops-sub" title={sgTime(a.createdAt)}>{ago(a.createdAt)}</span>
              </li>
            ))}
            {detail.data && !detail.data.adjustments.length && <li className="px-4 py-10 text-center text-[14px] text-ops-sub">没有调账记录。</li>}
          </ul>
        )}
        {tab === 'audit' && (
          <ul className="flex flex-col">
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-ops-rule px-3 py-3 last:border-0">
                <span className="min-w-0 flex-1"><span className="block font-mono text-[13px]">{a.action}</span><span className="block text-[12px] text-ops-sub">{a.actorType === 'admin' ? '管理员' : a.actorType === 'user' ? '用户本人' : a.actorType} · {a.objectType}{a.reasonCode ? ` · ${a.reasonCode}` : ''}</span></span>
                <span className="w-[140px] text-right text-[12px] text-ops-sub" title={sgTime(a.occurredAt)}>{ago(a.occurredAt)}</span>
              </li>
            ))}
            {audit.error && <li className="px-4 py-6 text-[14px] text-[#C23B33]">{audit.error}</li>}
            {audit.data && !audit.data.length && <li className="px-4 py-10 text-center text-[14px] text-ops-sub">没有记录。</li>}
          </ul>
        )}
      </Board>
      {adjusting && access.profile && <UserDetailDialog id={id} actorId={access.profile.id} canAdjust={canAdjust} onClose={() => setAdjusting(false)} onChanged={() => void detail.reload()} />}
      {!u && !detail.loading && !detail.error && <div className="mt-6"><CircleButton href="/users" label="返回用户列表">←</CircleButton></div>}
    </>
  )
}

export default function UserProfilePage() {
  return <AppShell><Suspense fallback={null}><Profile /></Suspense></AppShell>
}
