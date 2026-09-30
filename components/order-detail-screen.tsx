'use client'

/**
 * 订单凭证（/orders/detail）— 圆桌第4场 P0-A #⑨
 * 接入真实订单/账本记录；支持 CSV 导出（税务/审计/争议）。
 * 凭证数据不得来自前端本地状态。
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Copy, Download, FileText, RotateCw } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import RwaTopbar from './rwa-topbar'
import {
  fromAtomic,
  getOrder,
  ORDER_STATE_LABELS,
  ORDER_STATE_TONE,
  orderToCsv,
  type OrderView,
} from '@/lib/orders-data'
import { formatMoney, formatTime } from '@/lib/display/format'
import { assetCategoryLabel, ledgerDisplay, shortId } from '@/lib/display/labels'
import { useI18n } from '@/lib/i18n'
import { EmptyState } from './ui/Empty'

export function OrderDetailScreen({ orderId, go }: { orderId: string | null; go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const [order, setOrder] = useState<OrderView | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)

  const load = () => {
    if (!orderId) { setLoadState('error'); return }
    setLoadState('loading')
    getOrder(orderId)
      .then((data) => { setOrder(data); setLoadState('ready') })
      .catch(() => setLoadState('error'))
  }

  useEffect(load, [orderId])

  const exportCsv = () => {
    if (!order) return
    const blob = new Blob([`\ufeff${orderToCsv(order)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rwa-order-${order.id}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const copyId = () => {
    if (!order) return
    navigator.clipboard?.writeText(order.id)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section className="screen order-detail-screen">
      <RwaTopbar screen="order-detail" title="订单凭证" onBack={() => go('records')} action={order ? { label: '导出 CSV', onClick: exportCsv, Icon: Download } : undefined} />

      {loadState === 'loading' && <div className="address-book-list">{[0, 1].map((key) => <div key={key} className="address-skel" />)}</div>}

      {loadState === 'error' && (
        <div className="address-book-empty is-error">
          <AlertTriangle size={20} />
          <b>凭证加载失败</b>
          <small>无法获取该订单记录。请稍后重试；如持续失败请联系支持并附上订单号。</small>
          <button type="button" onClick={load}><RotateCw size={14} /> 重试</button>
        </div>
      )}

      {loadState === 'ready' && order && (
        <>
          <div className={`receipt-hero is-${ORDER_STATE_TONE[order.state] ?? 'info'}`}>
            {order.state === 'filled' ? <CheckCircle2 size={26} /> : <Clock3 size={26} />}
            <h1>{order.productName}</h1>
            <b className="receipt-hero__state">{ORDER_STATE_LABELS[order.state] ?? order.state}</b>
            <small>提交于 {formatTime(order.submittedAt, locale)}{order.completedAt ? ` · 完成于 ${formatTime(order.completedAt, locale)}` : ''}</small>
          </div>

          <section className="fees-block glass">
            <div className="fees-block-head"><FileText size={16} /><b>凭证明细</b><small>订单记录</small></div>
            <div className="fees-rows">
              <span><small>订单号</small><b>{shortId(order.id)} <button type="button" className="receipt-copy" onClick={copyId}><Copy size={12} /> {copied ? '已复制' : '复制'}</button></b></span>
              <span><small>请求金额</small><b>{formatMoney(fromAtomic(order.requestedAtomicAmount), locale)} USDT</b></span>
              <span><small>成交金额</small><b>{formatMoney(fromAtomic(order.filledAtomicAmount), locale)} USDT</b></span>
              <span><small>资产类别</small><b>{assetCategoryLabel(order.assetClassId, locale)}</b></span>
              {order.outcomeKey && <span><small>结果标的</small><b>{order.outcomeKey}</b></span>}
              {order.failureReason && <span><small>失败原因</small><b>{order.failureReason}</b></span>}
            </div>
          </section>

          <section className="fees-block glass">
            <div className="fees-block-head"><Clock3 size={16} /><b>状态时间线</b><small>{order.events.length} 条记录</small></div>
            <div className="receipt-timeline">
              {order.events.length === 0 && <EmptyState variant="inline" icon={AlertTriangle} title="暂无状态变更记录" body="订单产生新的状态事件后，会显示在这里。" />}
              {order.events.map((event, index) => (
                <div key={index} className="receipt-event">
                  <i />
                  <span>
                    <b>{event.previousState ? `${ORDER_STATE_LABELS[event.previousState] ?? event.previousState} → ` : ''}{ORDER_STATE_LABELS[event.nextState ?? ''] ?? event.nextState ?? '—'}</b>
                    <small>{ledgerDisplay(event.actorType, locale).label} · {formatTime(event.createdAt, locale)}{event.reasonCode ? ` · ${ledgerDisplay(event.reasonCode, locale).label}` : ''}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <button className="support-primary" type="button" onClick={exportCsv}><Download size={16} /> 导出 CSV 凭证</button>
          <p className="status-note"><FileText size={12} /> 该凭证汇总订单、账本与链上记录，可用于审计与争议处理。</p>
          <button className="quiet-action" type="button" onClick={() => go('support-new')}>对订单有疑问？提交工单</button>
        </>
      )}
    </section>
  )
}
