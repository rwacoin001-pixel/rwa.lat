'use client'

/**
 * 产品资料室（/invest/disclosures）— 圆桌第4场 P0-A #7
 * 展示产品全部披露文件；资料不完整时明确提示（资料不全 → 不可购买）。
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, FileText, RotateCw, ShieldAlert } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import RwaTopbar from './rwa-topbar'
import { apiUrl } from '@/lib/api/_http'
import { EmptyState } from './ui/Empty'
import {
  DISCLOSURE_KIND_LABELS,
  DISCLOSURE_KIND_ORDER,
  isDisclosureComplete,
  listProductDisclosures,
  type DisclosureFileView,
} from '@/lib/disclosures-data'

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function DisclosuresScreen({ productId, go }: { productId: string | null; go: (screen: RwaScreen) => void }) {
  const [files, setFiles] = useState<DisclosureFileView[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = () => {
    if (!productId) { setLoadState('error'); return }
    setLoadState('loading')
    listProductDisclosures(productId)
      .then((data) => { setFiles(data); setLoadState('ready') })
      .catch(() => setLoadState('error'))
  }

  useEffect(load, [productId])

  const complete = isDisclosureComplete(files)

  return (
    <section className="screen disclosures-screen">
      <RwaTopbar screen="disclosures" title="产品资料室" onBack={() => go('invest')} />

      <header className="address-book-header">
        <h1>披露文件</h1>
        <small>产品相关的法律与风险文件。购买前请完整阅读；资料不完整的产品不会开放购买。</small>
      </header>

      {loadState === 'loading' && (
        <div className="address-book-list">{[0, 1, 2].map((key) => <div key={key} className="address-skel" style={{ height: 64 }} />)}</div>
      )}

      {loadState === 'error' && (
        <EmptyState variant="card" icon={AlertTriangle} title="资料加载失败" body="请稍后重试，或联系支持获取文件副本。" action={<button type="button" className="p0a-secondary-button" onClick={load}><RotateCw size={14} /> 重试</button>} />
      )}

      {loadState === 'ready' && files.length === 0 && (
        <EmptyState variant="card" icon={FileText} title="该产品暂无披露文件" body="资料尚未发布或正在更新。为保护你的权益，资料不完整期间产品不开放购买。" />
      )}

      {loadState === 'ready' && files.length > 0 && (
        <>
          <div className={`disclosure-status ${complete ? 'is-ok' : 'is-warn'}`}>
            {complete
              ? <><ShieldAlert size={15} /><span>资料完整（含招募说明书与风险披露），产品可正常申购。</span></>
              : <><AlertTriangle size={15} /><span>资料不完整：缺少招募说明书或风险披露，产品将不开放购买。</span></>}
          </div>

          {DISCLOSURE_KIND_ORDER.map((kind) => {
            const group = files.filter((file) => file.kind === kind)
            if (group.length === 0) return null
            return (
              <section key={kind} className="disclosure-group">
                <div className="support-section-heading"><b>{DISCLOSURE_KIND_LABELS[kind]}</b><small>{group.length} 份</small></div>
                <div className="disclosure-list">
                  {group.map((file) => (
                    <article key={file.id} className="disclosure-card">
                      <span className="disclosure-card__icon"><FileText size={16} /></span>
                      <p>
                        <b>{file.url ? <a href={apiUrl(file.url)} target="_blank" rel="noopener noreferrer">{file.title}</a> : file.title}</b>
                        <small>{file.locale.toUpperCase()} · {formatDate(file.published_at)}</small>
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}

          <p className="status-note"><FileText size={12} /> 需要文件副本或语言版本协助？通过支持工单提交请求（可绑定产品编号）。</p>
          <button className="support-primary" type="button" onClick={() => go('support-new')}>请求文件副本</button>
        </>
      )}
    </section>
  )
}
