'use client'

/**
 * 提现地址簿（/wallet/address-book）— 圆桌第4场 P0-A #5 提现安全闭环
 * 白名单地址 + 冷却期 + risk screening 状态，全部来自真实 API。
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Bookmark, Clock3, Plus, RotateCw, ShieldCheck, Trash2 } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import RwaTopbar from './rwa-topbar'
import {
  ADDRESS_NETWORKS,
  ADDRESS_STATE_LABELS,
  ADDRESS_STATE_TONE,
  addWithdrawalAddress,
  cooldownRemainingMs,
  listWithdrawalAddresses,
  maskAddress,
  revokeWithdrawalAddress,
  type AddressBookView,
} from '@/lib/withdrawal-data'

const formatCountdown = (ms: number) => {
  if (ms <= 0) return null
  const totalMinutes = Math.ceil(ms / 60000)
  if (totalMinutes < 60) return `${totalMinutes} 分钟`
  return `${Math.ceil(totalMinutes / 60)} 小时`
}

export function AddressBookScreen({ go, notify }: { go: (screen: RwaScreen) => void; notify: (message: string) => void }) {
  const [view, setView] = useState<AddressBookView | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [network, setNetwork] = useState<string>(ADDRESS_NETWORKS[0])
  const [destination, setDestination] = useState('')
  const [reauth, setReauth] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const load = useCallback(() => {
    setLoadState('loading')
    listWithdrawalAddresses()
      .then((data) => { setView(data); setLoadState('ready') })
      .catch(() => setLoadState('error'))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!label.trim() || destination.trim().length < 20 || reauth.trim().length < 20) {
      setFormError('请填写标签、完整地址，并完成再验证（口令/确认串至少 20 位）')
      return
    }
    setSubmitting(true)
    setFormError(null)
    addWithdrawalAddress({ network, destination: destination.trim(), label: label.trim(), reauthentication: reauth.trim() })
      .then(() => {
        notify('地址已添加，进入安全冷却期')
        setLabel(''); setDestination(''); setReauth(''); setShowForm(false)
        load()
      })
      .catch(() => setFormError('添加失败：地址校验或再验证未通过，请检查后重试'))
      .finally(() => setSubmitting(false))
  }

  const revoke = (id: string, addressLabel: string) => {
    const code = window.prompt(`撤销「${addressLabel}」需要再验证，请输入确认串（≥20 位）：`)
    if (!code || code.trim().length < 20) return
    revokeWithdrawalAddress(id, code.trim())
      .then(() => { notify('地址已撤销'); load() })
      .catch(() => notify('撤销失败：再验证未通过'))
  }

  const entries = view?.entries.filter((entry) => entry.state !== 'revoked') ?? []

  return (
    <section className="screen address-book-screen">
      <RwaTopbar screen="address-book" title="提现地址簿" onBack={() => go('wallet')} />

      <header className="address-book-header">
        <h1>地址白名单</h1>
        <small>提现仅可发送到白名单地址。新地址经过风控筛查后进入冷却期，冷却结束自动启用。</small>
      </header>

      {view && (
        <div className="address-book-policy glass">
          <ShieldCheck size={15} />
          <span>冷却期 {Math.round(view.policy.cooldownSeconds / 60)} 分钟 · 每次撤销/新增均需再验证</span>
        </div>
      )}

      {loadState === 'loading' && (
        <div className="address-book-list">
          {[0, 1].map((key) => <div key={key} className="address-skel" />)}
        </div>
      )}

      {loadState === 'error' && (
        <div className="address-book-empty is-error">
          <AlertTriangle size={20} />
          <b>地址簿加载失败</b>
          <small>请检查网络后重试。你的资金与地址记录不受影响。</small>
          <button type="button" onClick={load}><RotateCw size={14} /> 重试</button>
        </div>
      )}

      {loadState === 'ready' && entries.length === 0 && (
        <div className="address-book-empty">
          <Bookmark size={20} />
          <b>还没有白名单地址</b>
          <small>添加后需要再验证与冷却期，期间提现暂不可用该地址。</small>
        </div>
      )}

      {loadState === 'ready' && entries.length > 0 && (
        <div className="address-book-list">
          {entries.map((entry) => {
            const remaining = cooldownRemainingMs(entry.cooldownUntil)
            const countdown = formatCountdown(remaining)
            return (
              <article key={entry.id} className="address-card">
                <div className="address-card__top">
                  <span className="address-card__icon"><ShieldCheck size={16} /></span>
                  <b>{entry.label}</b>
                  <span className={`address-badge is-${ADDRESS_STATE_TONE[entry.state]}`}>{ADDRESS_STATE_LABELS[entry.state]}</span>
                </div>
                <p className="address-card__meta">{entry.network} · {entry.assetCode}</p>
                <p className="address-card__dest">{maskAddress(entry.destination)}</p>
                {entry.state === 'pending' && countdown && (
                  <p className="address-card__cooldown"><Clock3 size={13} /> 冷却中，约 {countdown} 后启用</p>
                )}
                {entry.state === 'pending' && !countdown && (
                  <p className="address-card__cooldown"><Clock3 size={13} /> 冷却已完成，即将启用</p>
                )}
                <div className="address-card__actions">
                  <button type="button" className="address-revoke" onClick={() => revoke(entry.id, entry.label)}>
                    <Trash2 size={13} /> 撤销
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!showForm && (
        <button className="support-primary" type="button" onClick={() => setShowForm(true)}>
          <Plus size={16} /> 添加白名单地址
        </button>
      )}

      {showForm && (
        <form className="support-form glass" onSubmit={submit}>
          <label>标签
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：我的 TRON 主钱包" maxLength={80} />
          </label>
          <label>网络
            <select value={network} onChange={(event) => setNetwork(event.target.value)}>
              {ADDRESS_NETWORKS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>地址
            <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="粘贴完整地址（≥20 位）" />
          </label>
          <label>再验证确认串
            <input value={reauth} onChange={(event) => setReauth(event.target.value)} placeholder="MFA/Passkey 授权串（≥20 位）" type="password" />
          </label>
          {formError && <p className="support-form-error"><AlertTriangle size={14} /> {formError}</p>}
          <div className="address-form-actions">
            <button type="button" className="quiet-action" onClick={() => setShowForm(false)}>取消</button>
            <button type="submit" className="support-primary" disabled={submitting}>{submitting ? '提交中…' : '提交并筛查'}</button>
          </div>
        </form>
      )}
    </section>
  )
}
