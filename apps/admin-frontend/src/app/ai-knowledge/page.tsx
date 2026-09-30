'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, Panel, useApi } from '@/components/console/framework'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KnowledgeCoverage } from './KnowledgeCoverage'

type Content = { title: string; summary: string; body: string; category: string; locale: string; visibility: string; productIds: string[]; effectiveAt: string | null; expiresAt: string | null }
type Row = { id: string; revision: number; draft: Content; publishedRevision: number | null; archivedAt: string | null }
type Version = { revision: number; content: Content; publishedAt: string }
const EMPTY: Content = { title: '', summary: '', body: '', category: 'project', locale: 'zh-CN', visibility: 'public', productIds: [], effectiveAt: null, expiresAt: null }
function localDate(value: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export default function AiKnowledgePage() {
  const list = useApi<Row[]>('/api/admin/ai-knowledge')
  const products = useApi<Array<{ id: string; displayName: string }>>('/api/admin/ai-knowledge/products')
  const [selected, setSelected] = useState<Row | null>(null)
  const history = useApi<Version[]>(selected ? `/api/admin/ai-knowledge/${selected.id}/versions` : null)
  const [form, setForm] = useState<Content>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  function edit(row: Row | null) { setSelected(row); setForm(row ? { ...row.draft, productIds: [...row.draft.productIds] } : { ...EMPTY, productIds: [] }); setDirty(false); setStatus('') }
  function change(patch: Partial<Content>) { setForm(current => ({ ...current, ...patch })); setDirty(true) }
  async function action(kind: 'save' | 'publish' | 'archive' | 'restore', sourceRevision?: number) {
    if (busy || (kind !== 'save' && (!selected || dirty))) return
    setBusy(true); setStatus(''); setFailed(false)
    try {
      const path = selected ? `/${selected.id}/${kind}` : ''
      const body = kind === 'save' ? { ...form, expectedRevision: selected?.revision ?? 0 } : { expectedRevision: selected!.revision, ...(sourceRevision ? { sourceRevision } : {}) }
      const response = await fetch(`/api/admin/ai-knowledge${path}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error?.message ?? value.message ?? '操作失败')
      if (kind === 'save') {
        setSelected({ id: value.id, revision: value.revision, draft: { ...form }, publishedRevision: selected?.publishedRevision ?? null, archivedAt: selected?.archivedAt ?? null }); setDirty(false)
      } else if (kind === 'restore') {
        const restored = history.data?.find(row => row.revision === sourceRevision)
        if (restored) { setForm(restored.content); setSelected({ ...selected!, revision: value.revision, draft: restored.content }); setDirty(false) }
      } else {
        setSelected({ ...selected!, publishedRevision: kind === 'publish' ? value.revision : selected!.publishedRevision, archivedAt: kind === 'archive' ? new Date().toISOString() : null })
      }
      setStatus({ save: '草稿已保存', publish: '已发布', archive: '已下架', restore: '已恢复为草稿' }[kind]); list.reload(); history.reload()
    } catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : '操作失败') }
    finally { setBusy(false) }
  }
  return <AdminLayout><div className="space-y-5">
    <PageHeader title="客服知识库" actions={<Button variant="outline" disabled={busy || dirty} onClick={() => edit(null)}>新增知识</Button>} />
    {status ? <p role={failed ? 'alert' : 'status'} className="text-sm">{status}</p> : null}
    {list.error ? <p role="alert">{list.error} <Button onClick={list.reload}>重试</Button></p> : null}
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Panel title="条目"><div className="space-y-2">{list.loading ? <p role="status">加载中</p> : list.data?.length ? list.data.map(row => <button key={row.id} type="button" disabled={busy || dirty} onClick={() => edit(row)} aria-pressed={selected?.id === row.id} className="block w-full rounded-xl border p-3 text-left aria-pressed:border-primary"><span className="block font-medium">{row.draft.title}</span><span className="text-xs text-text-secondary">{row.draft.locale} · {row.archivedAt ? '已下架' : row.publishedRevision ? `发布 v${row.publishedRevision}` : '草稿'}{row.publishedRevision && row.revision !== row.publishedRevision ? ' · 有修改' : ''}</span></button>) : <p className="text-sm text-text-secondary">暂无知识</p>}</div></Panel>
      <div className="space-y-5"><Panel title={selected ? '编辑' : '新建'}><fieldset disabled={busy} className="space-y-4 border-0">
        <label className="block text-sm">标题<Input value={form.title} maxLength={200} onChange={event => change({ title: event.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm">语言<select className="mt-2 w-full rounded-xl border p-2" value={form.locale} disabled={Boolean(selected)} onChange={event => change({ locale: event.target.value })}>{['zh-CN', 'en', 'hi', 'es', 'ar', 'fr', 'pt'].map(locale => <option key={locale}>{locale}</option>)}</select></label>
          <label className="text-sm">分类<Input value={form.category} maxLength={80} onChange={event => change({ category: event.target.value })} /></label>
          <label className="text-sm">可见范围<select className="mt-2 w-full rounded-xl border p-2" value={form.visibility} onChange={event => change({ visibility: event.target.value })}><option value="public">公开</option><option value="authenticated">登录用户</option><option value="internal">内部资料</option></select></label></div>
        <label className="block text-sm">摘要<Input value={form.summary} maxLength={600} onChange={event => change({ summary: event.target.value })} /></label>
        <label className="block text-sm">正文<textarea rows={12} maxLength={6000} value={form.body} className="mt-2 w-full rounded-xl border bg-transparent p-3" onChange={event => change({ body: event.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">{(['effectiveAt', 'expiresAt'] as const).map((key, index) => <label key={key} className="text-sm">{index ? '失效时间' : '生效时间'}<Input type="datetime-local" value={localDate(form[key])} onChange={event => change({ [key]: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>)}</div>
        <fieldset className="rounded-xl border p-3"><legend className="px-1 text-sm">关联产品</legend>{products.error ? <p role="alert">{products.error}</p> : <div className="grid max-h-40 gap-2 overflow-auto sm:grid-cols-2">{products.data?.map(product => <label key={product.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.productIds.includes(product.id)} onChange={event => change({ productIds: event.target.checked ? [...form.productIds, product.id] : form.productIds.filter(id => id !== product.id) })} />{product.displayName}</label>)}</div>}</fieldset>
        <div className="flex flex-wrap gap-2"><Button disabled={!form.title.trim() || !form.body.trim() || !form.category.trim()} onClick={() => void action('save')}>保存草稿</Button><Button disabled={!selected || dirty} onClick={() => void action('publish')}>发布</Button><Button variant="outline" disabled={!selected?.publishedRevision || dirty} onClick={() => void action('archive')}>下架</Button>{dirty ? <Button variant="ghost" onClick={() => edit(selected)}>放弃修改</Button> : null}</div>
      </fieldset></Panel>
      <Panel title="预览"><h2 className="font-medium">{form.title}</h2><p className="mt-2 text-sm text-text-secondary">{form.summary}</p><div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{form.body}</div></Panel>
      {selected ? <Panel title="发布记录">{history.error ? <p role="alert">{history.error}</p> : history.data?.map(version => <div key={version.revision} className="flex items-center justify-between gap-3 border-b py-3 text-sm"><span>v{version.revision} · {new Date(version.publishedAt).toLocaleString()}</span><Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => void action('restore', version.revision)}>恢复为草稿</Button></div>)}</Panel> : null}
      </div>
    </div>
    <KnowledgeCoverage />
  </div></AdminLayout>
}
