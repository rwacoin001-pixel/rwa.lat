'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader } from '@/components/console/framework'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminApi, type LegalConfiguration, type LegalContent, type LegalKind, type LegalVersion } from '@/lib/admin-api'

const names = { terms: '服务条款', privacy: '隐私政策' }
const empty = (kind: LegalKind): LegalContent => ({ title: names[kind], effectiveDate: new Date().toISOString().slice(0,10), sections: [{ title: '', body: '' }] })
export default function LegalEditorPage() {
  const [kind, setKind] = useState<LegalKind>('terms')
  const [configuration, setConfiguration] = useState<LegalConfiguration | null>(null)
  const [form, setForm] = useState<LegalContent>(() => empty('terms'))
  const [history, setHistory] = useState<LegalVersion[]>([])
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const [preview, setPreview] = useState<LegalContent | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const apply = (value: LegalConfiguration) => { setConfiguration(value); setForm({ ...empty(value.kind), ...value.draft }); setDirty(false) }
  useEffect(() => {
    let active = true
    setBusy(true); setConfiguration(null); setHistory([]); setNotice(''); setPreview(null)
    void Promise.all([adminApi.getLegal(kind), adminApi.legalVersions(kind)]).then(([value, versions]) => {
      if (active) { apply(value); setHistory(versions); setFailed(false) }
    }).catch(e => { if (active) { setFailed(true); setNotice(e instanceof Error ? e.message : '加载失败') } })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [kind])
  const change = (patch: Partial<LegalContent>) => { setForm(current => ({ ...current, ...patch })); setDirty(true) }
  const act = async (work: () => Promise<void>) => {
    setBusy(true); setNotice(''); setFailed(false)
    try { await work() } catch(e) { setFailed(true); setNotice(e instanceof Error ? e.message : '操作失败') }
    finally { setBusy(false) }
  }
  const reload = () => void act(async () => { const [value,versions]=await Promise.all([adminApi.getLegal(kind),adminApi.legalVersions(kind)]);apply(value);setHistory(versions);setPreview(null) })
  return <AdminLayout><div className="space-y-5">
    <PageHeader title="服务条款与隐私" subtitle="发布后仅新注册用户确认；历史版本保留。" />
    <div className="flex flex-wrap gap-2" role="group" aria-label="法律文件">
      {(['terms','privacy'] as const).map(value => <Button key={value} variant={kind === value ? 'default' : 'outline'} disabled={busy || dirty} onClick={() => setKind(value)} aria-pressed={kind === value}>{names[value]}</Button>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" disabled={busy} onClick={() => { if (dirty) setDiscardOpen(true); else reload() }}>重新加载</Button>
      <Button disabled={busy || !configuration} onClick={() => void act(async () => {
        if (configuration) { apply(await adminApi.saveLegal(kind, configuration.revision, form)); setNotice('草稿已保存') }
      })}>保存草稿</Button>
      <Button variant="outline" disabled={busy || !configuration || dirty || configuration.revision === 0 || configuration.publishedRevision === configuration.revision} onClick={() => void act(async () => {
        if (configuration) { apply(await adminApi.publishLegal(kind,configuration.revision)); setHistory(await adminApi.legalVersions(kind)); setNotice('已发布') }
      })}>发布已保存版本</Button>
      <Button variant="outline" disabled={!configuration} onClick={() => setPreview(form)}>预览</Button>
      <span className="text-sm text-text-secondary">草稿 v{configuration?.revision ?? '—'} · 已发布 {configuration?.publishedRevision ? `v${configuration.publishedRevision}` : '无'}{dirty ? ' · 未保存' : ''}</span>
    </div>
    {notice && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-negative' : 'text-emerald-700'}>{notice}</p>}
    <fieldset className="space-y-4 rounded-card border p-5" disabled={busy || !configuration}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="legal-title">标题</Label><Input id="legal-title" maxLength={160} value={form.title} onChange={e => change({ title:e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="legal-date">生效日期</Label><Input id="legal-date" type="date" max={new Date().toISOString().slice(0,10)} value={form.effectiveDate} onChange={e => change({ effectiveDate:e.target.value })} /></div>
      </div>
      {form.sections.map((section,index) => <div key={index} className="space-y-2 rounded-xl border p-3">
        <Label htmlFor={`legal-heading-${index}`}>章节标题（可选）</Label><Input id={`legal-heading-${index}`} value={section.title} maxLength={160} onChange={e => change({ sections:form.sections.map((s,i) => i === index ? { ...s,title:e.target.value } : s) })} />
        <Label htmlFor={`legal-body-${index}`}>正文</Label><textarea id={`legal-body-${index}`} maxLength={20000} value={section.body} onChange={e => change({ sections:form.sections.map((s,i) => i === index ? { ...s,body:e.target.value } : s) })} className="min-h-48 w-full rounded-xl border bg-transparent p-3 text-sm leading-relaxed" />
        {form.sections.length > 1 && <Button variant="outline" onClick={() => change({ sections:form.sections.filter((_,i) => i !== index) })}>移除章节</Button>}
      </div>)}
      <Button variant="outline" disabled={form.sections.length >= 40} onClick={() => change({ sections:[...form.sections,{ title:'',body:'' }] })}>添加章节</Button>
    </fieldset>
    {preview && <section aria-label="正文预览" className="space-y-4 rounded-card border p-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-medium">{preview.title}</h2><Button variant="ghost" onClick={() => setPreview(null)}>关闭预览</Button></div>
      <p className="text-xs text-text-secondary">{preview.effectiveDate}</p>
      {preview.sections.map((section,i) => <div key={i} className="space-y-2">{section.title && <h3 className="text-sm font-medium">{i+1}. {section.title}</h3>}<p className="whitespace-pre-wrap text-sm leading-relaxed">{section.body}</p></div>)}
    </section>}
    {!!history.length && <section className="space-y-2"><h2 className="text-sm font-medium">已发布版本</h2>{history.map(row => <div key={row.version} className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm">
      <span>{row.version}</span><time dateTime={row.publishedAt}>{new Date(row.publishedAt).toLocaleString()}</time><Button variant="ghost" onClick={() => setPreview(row.content)}>查看正文</Button>
    </div>)}</section>}
    <ConfirmDialog open={discardOpen} onOpenChange={setDiscardOpen} title="放弃未保存修改？" description={`${names[kind]}草稿有未保存的修改，重新加载后将丢失。`} confirmLabel="放弃并重新加载" destructive onConfirm={reload} />
  </div></AdminLayout>
}
