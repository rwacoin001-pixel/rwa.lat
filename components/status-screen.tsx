'use client'

/**
 * 系统状态页（/status）— 圆桌第4场 P0-A #8
 * 正常/部分受限/只读/数据未就绪/无法连接 五态；服务逐项显示。无法连接时不声称任何功能仍可用。
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, RotateCw, Server, ShieldCheck, XCircle } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import RwaTopbar from './rwa-topbar'
import {
  getCapabilities,
  getLiveness,
  getReadiness,
  type CapabilitySnapshot,
} from '@/lib/status-data'
import { useI18n } from '@/lib/i18n'
import { statusCopy } from '@/lib/maison-status-copy'

type ServiceValue = 'unknown' | 'ok' | 'down'
type ServiceState = { api: ServiceValue; database: ServiceValue; checkedAt: string | null }

export function StatusScreen({ go }: { go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const copy = statusCopy[locale]
  const [services, setServices] = useState<ServiceState>({ api: 'unknown', database: 'unknown', checkedAt: null })
  const [snapshot, setSnapshot] = useState<CapabilitySnapshot | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [capsFailed, setCapsFailed] = useState(false)

  const load = useCallback(() => {
    setLoadState('loading')
    Promise.allSettled([getLiveness(), getReadiness(), getCapabilities()])
      .then(([live, ready, caps]) => {
        setServices({
          api: live.status === 'fulfilled' ? 'ok' : 'down',
          database: ready.status === 'fulfilled' ? 'ok' : 'down',
          checkedAt: new Date().toISOString(),
        })
        setSnapshot(caps.status === 'fulfilled' ? caps.value : null)
        setCapsFailed(caps.status === 'rejected')
        setLoadState(live.status === 'fulfilled' || ready.status === 'fulfilled' ? 'ready' : 'error')
      })
  }, [])

  useEffect(() => { load() }, [load])

  const pausedCount = snapshot ? Object.values(snapshot.capabilities).filter((cap) => cap.status === 'paused').length : 0
  const totalCount = snapshot ? Object.keys(snapshot.capabilities).length : 0
  const allPaused = totalCount > 0 && pausedCount === totalCount
  const somePaused = pausedCount > 0 && !allPaused

  /** A dead liveness probe cannot distinguish the user's network from maintenance, so it is reported as unreachable. */
  const mode: 'loading' | 'normal' | 'partial' | 'readonly' | 'degraded' | 'unreachable' =
    loadState === 'loading'
      ? 'loading'
      : services.api === 'down'
      ? 'unreachable'
      : services.database === 'down'
      ? 'degraded'
      : allPaused
        ? 'readonly'
        : somePaused
          ? 'partial'
          : 'normal'

  const modeCopy = {
    loading: { label: copy.checking, body: copy.checkingBody, tone: 'neutral' },
    normal: { label: copy.normal, body: copy.normalBody, tone: 'ok' },
    partial: { label: copy.partial, body: copy.partialBody.replace('{n}', String(pausedCount)), tone: 'warn' },
    readonly: { label: copy.readonly, body: copy.readonlyBody, tone: 'warn' },
    degraded: { label: copy.degraded, body: copy.degradedBody, tone: 'warn' },
    unreachable: { label: copy.unreachable, body: copy.unreachableBody, tone: 'error' },
  }[mode]

  const serviceIcon = (value: ServiceValue) => value === 'unknown' ? <RotateCw size={15} /> : value === 'ok' ? <CheckCircle2 size={15} className="is-ok" /> : <XCircle size={15} className="is-down" />
  const serviceClass = (value: ServiceValue) => value === 'unknown' ? undefined : value === 'ok' ? 'is-ok' : 'is-down'

  return (
    <section className="screen status-screen">
      <RwaTopbar screen="status" title={copy.title} onBack={() => go('profile')} />

      <div className={`status-hero is-${modeCopy.tone}`}>
        <span>
          {mode === 'loading' ? <RotateCw size={26} /> : mode === 'normal' ? <CheckCircle2 size={26} /> : mode === 'unreachable' ? <XCircle size={26} /> : <AlertTriangle size={26} />}
        </span>
        <h1>{modeCopy.label}</h1>
        <p role={mode === 'unreachable' ? 'alert' : undefined}>{modeCopy.body}</p>
        {services.checkedAt && <small>{copy.lastChecked} · {new Date(services.checkedAt).toLocaleTimeString(locale)}</small>}
      </div>

      <section className="status-block glass">
        <div className="status-block-head"><Server size={16} /><b>{copy.services}</b><button type="button" onClick={load} disabled={loadState === 'loading'}><RotateCw size={13} /> {copy.refresh}</button></div>
        <div className="status-rows">
          <span>
            {serviceIcon(services.api)}
            <small>{copy.core}</small>
            <b className={serviceClass(services.api)}>{services.api === 'unknown' ? copy.pending : services.api === 'ok' ? copy.running : copy.down}</b>
          </span>
          <span>
            {serviceIcon(services.database)}
            <small><Database size={12} /> {copy.database}</small>
            <b className={serviceClass(services.database)}>{services.database === 'unknown' ? copy.pending : services.database === 'ok' ? copy.ready : copy.issue}</b>
          </span>
        </div>
      </section>

      {loadState === 'loading' && <div className="address-skel" />}

      {snapshot && (
        <section className="status-block glass">
          <div className="status-block-head"><ShieldCheck size={16} /><b>{copy.switches}</b><small>{totalCount - pausedCount}/{totalCount} {copy.enabled}</small></div>
          <div className="status-rows">
            {Object.entries(snapshot.capabilities).map(([key, cap]) => (
              <span key={key}>
                {cap.status === 'enabled' ? <CheckCircle2 size={15} className="is-ok" /> : <AlertTriangle size={15} className="is-warn" />}
                <small>{copy.caps[key] ?? key}</small>
                <b className={cap.status === 'enabled' ? 'is-ok' : 'is-warn'}>
                  {cap.status === 'enabled' ? copy.enabled : cap.reasonCode ? copy.reasons[cap.reasonCode] ?? copy.paused : copy.paused}
                </b>
              </span>
            ))}
          </div>
          <p className="status-note"><ShieldCheck size={12} /> {copy.statusNote}</p>
        </section>
      )}

      {capsFailed && services.api === 'ok' && <p className="status-note" role="status"><AlertTriangle size={12} /> {copy.capsFailed}</p>}

      {mode === 'readonly' && (
        <div className="status-safety glass">
          <div className="status-safety-actions">
            <button type="button" onClick={() => go('portfolio')}>{copy.positions}</button>
            <button type="button" onClick={() => go('support')}>{copy.help}</button>
          </div>
        </div>
      )}
    </section>
  )
}
