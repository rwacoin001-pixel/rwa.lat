'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, Panel, useApi } from '@/components/console/framework'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Content = { title: string; summary: string; body: string; author: string }
type Row = { id: string; slug: string; locale: string; revision: number; draft: Content; publishedRevision: number | null; publishedAt: string | null; archivedAt: string | null }
const EMPTY = { slug: '', locale: 'zh-CN', title: '', summary: '', body: '', author: '' }

export default function ContentPage() {
  const list = useApi<Row[]>('/api/admin/content/articles')
  const [selected, setSelected] = useState<Row | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  function edit(row: Row | null) { setSelected(row); setForm(row ? { slug: row.slug, locale: row.locale, ...row.draft } : EMPTY); setDirty(false); setMessage('') }
  function change(patch: Partial<typeof form>) { setForm(current => ({ ...current, ...patch })); setDirty(true) }
  async function act(path: string, body: unknown) {
    if (busy) return
    setBusy(true); setMessage(''); setFailed(false)
    try {
      const response = await fetch(`/api/admin/content/articles${path}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.message ?? value.error?.message ?? '操作失败')
      list.reload()
      if (!path || path.endsWith('/save')) { setSelected({ id: value.id, slug: form.slug, locale: form.locale, revision: value.revision, draft: { title: form.title, summary: form.summary, body: form.body, author: form.author }, publishedRevision: selected?.publishedRevision ?? null, publishedAt: selected?.publishedAt ?? null, archivedAt: selected?.archivedAt ?? null }); setDirty(false); setMessage('草稿已保存。确认内容后发布。') }
      else { edit(null); setMessage(path.endsWith('/archive') ? '文章已下架，公开页面不再展示。' : '文章已发布，学习中心可读取。') }
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : '操作失败') }
    finally { setBusy(false) }
  }
  return <AdminLayout><div className="space-y-5">
    <PageHeader title="学习内容" subtitle="维护真实文章；草稿不会公开，发布后按语言展示。" />
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    {list.error && <p role="alert">{list.error}<Button onClick={list.reload}>重试</Button></p>}
    <Panel title="已保存文章"><div className="space-y-3"><Button variant="outline" disabled={busy || dirty} onClick={() => edit(null)}>新建文章</Button>{list.data?.map(row => <button key={row.id} type="button" disabled={busy || dirty} onClick={() => edit(row)} className="block w-full rounded-xl border p-3 text-left"><b>{row.draft.title}</b> · {row.locale} · 草稿 v{row.revision} · {row.archivedAt ? '已下架' : row.publishedRevision ? `已发布 v${row.publishedRevision}` : '未发布'}</button>)}</div></Panel>
    <Panel title={selected ? '编辑文章' : '新建文章'}><fieldset disabled={busy} className="space-y-4 border-0">
      <label className="block">文章路径标识<Input value={form.slug} disabled={Boolean(selected)} placeholder="reading-product-risk" onChange={e => change({ slug: e.target.value })} /></label>
      <label className="block">语言<select value={form.locale} disabled={Boolean(selected)} onChange={e => change({ locale: e.target.value })} className="ml-3 rounded-xl border p-2">{['zh-CN','en','hi','es','ar','fr','pt'].map(locale => <option key={locale} value={locale}>{locale}</option>)}</select></label>
      {(['title','summary','author'] as const).map((key,i) => <label key={key} className="block">{['标题','摘要','署名'][i]}<Input value={form[key]} maxLength={key === 'summary' ? 600 : key === 'author' ? 120 : 200} onChange={e => change({ [key]: e.target.value })} /></label>)}
      <label className="block">正文（纯文本）<textarea value={form.body} rows={12} maxLength={50000} className="mt-2 w-full rounded-xl border p-3" onChange={e => change({ body: e.target.value })} /></label>
      <div className="flex flex-wrap gap-3"><Button disabled={!form.title.trim() || !form.author.trim() || !form.body.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug)} onClick={() => void act(selected ? `/${selected.id}/save` : '', { ...form, ...(selected ? { expectedRevision: selected.revision } : {}) })}>保存草稿</Button><Button disabled={!selected || dirty} onClick={() => selected && void act(`/${selected.id}/publish`, { expectedRevision: selected.revision })}>发布已保存版本</Button><Button variant="outline" disabled={!selected?.publishedRevision || dirty} onClick={() => selected && void act(`/${selected.id}/archive`, { expectedRevision: selected.revision })}>下架文章</Button></div>
    </fieldset></Panel>
  </div></AdminLayout>
}
