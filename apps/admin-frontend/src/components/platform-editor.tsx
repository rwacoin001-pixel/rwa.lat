'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader } from '@/components/console/framework'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StoragePicker } from '@/components/storage-picker'
import { StorageUpload } from '@/components/storage-upload'
import { adminApi, type PlatformContent, type PlatformConfiguration, type VerifiedAccess } from '@/lib/admin-api'

const EMPTY_ACCESS: VerifiedAccess = { region: '', investorType: 'retail', evidenceRef: '' }
const EMPTY: PlatformContent = { legalName: '', registrationNumber: '', jurisdiction: '', address: '', supportEmail: '', description: '', allowedRegions: [], investorTypes: [], documents: [], officialChannels: [] }
const TYPES = [{ value: 'retail', label: '零售客户' }, { value: 'professional', label: '专业投资者' }, { value: 'institutional', label: '机构客户' }]

export function PlatformEditor({ regions = false }: { regions?: boolean }) {
  const [configuration, setConfiguration] = useState<PlatformConfiguration | null>(null)
  const [form, setForm] = useState<PlatformContent>(EMPTY)
  const [regionText, setRegionText] = useState('')
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [versions, setVersions] = useState<Array<{ revision: number; publishedAt: string }>>([])
  const [userId, setUserId] = useState('')
  const [access, setAccess] = useState<VerifiedAccess>(EMPTY_ACCESS)
  function apply(value: PlatformConfiguration) {
    const next = { ...EMPTY, ...value.draft }
    setConfiguration(value); setForm(next); setRegionText(next.allowedRegions.join(', ')); setDirty(false)
  }
  async function load() {
    setBusy(true)
    try { const [value, history] = await Promise.all([adminApi.getPlatform(), adminApi.platformVersions()]); apply(value); setVersions(history); setFailed(false); setNotice('') }
    catch (e) { setFailed(true); setNotice(e instanceof Error ? e.message : '加载失败') }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  function change(patch: Partial<PlatformContent>) { setForm(current => ({ ...current, ...patch })); setDirty(true) }
  async function act(work: () => Promise<void>) {
    setBusy(true); setNotice(''); setFailed(false)
    try { await work() } catch (e) { setFailed(true); setNotice(e instanceof Error ? e.message : '操作失败') }
    finally { setBusy(false) }
  }
  const save = () => act(async () => {
    if (!configuration) return
    const allowedRegions = [...new Set(regionText.toUpperCase().split(/[\s,，;；]+/).filter(Boolean))]
    if (!allowedRegions.length || allowedRegions.some(code => !/^[A-Z]{2}$/.test(code))) throw new Error('请填写两位国家或地区代码，用逗号分隔')
    apply(await adminApi.savePlatform(configuration.revision, { ...form, allowedRegions }))
    setNotice('草稿已保存。发布后公开资料和地区准入规则才会更新。')
  })
  const publish = () => act(async () => {
    if (!configuration || dirty) return
    apply(await adminApi.publishPlatform(configuration.revision))
    setVersions(await adminApi.platformVersions()); setNotice('资料已发布，地区与客户类型规则已生效。')
  })
  return <AdminLayout><div className="space-y-5">
    <PageHeader title={regions ? '地区与客户准入' : '运营主体与资料'} subtitle="商务自行维护资料；保存草稿后，明确发布才对外生效。" />
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={() => void load()} disabled={busy || dirty}>刷新</Button>
      <Button onClick={() => void save()} disabled={busy || !configuration}>保存草稿</Button>
      <Button onClick={() => void publish()} disabled={busy || !configuration || dirty || configuration.revision === configuration.publishedRevision || configuration.revision === 0}>发布已保存版本</Button>
      <span className="text-sm text-text-secondary">草稿 v{configuration?.revision ?? '—'} · 已发布 {configuration?.publishedRevision ? `v${configuration.publishedRevision}` : '无'}{dirty ? ' · 有未保存修改' : ''}</span>
    </div>
    {notice && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-negative' : 'text-emerald-700'}>{notice}</p>}
    <fieldset disabled={busy || !configuration} className="space-y-5">
      <Card><CardHeader><CardTitle>运营主体</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        {([{ key: 'legalName', label: '法定主体名称' }, { key: 'registrationNumber', label: '注册编号' }, { key: 'jurisdiction', label: '注册地代码（如 SG）' }, { key: 'supportEmail', label: '客服邮箱' }, { key: 'address', label: '联系地址' }] as const).map(({ key, label }) => <div key={key} className="space-y-2"><Label htmlFor={`platform-${key}`}>{label}</Label><Input id={`platform-${key}`} type={key === 'supportEmail' ? 'email' : 'text'} maxLength={key === 'jurisdiction' ? 2 : 500} value={form[key]} onChange={e => change({ [key]: key === 'jurisdiction' ? e.target.value.toUpperCase() : e.target.value })} /></div>)}
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="platform-description">对外说明</Label><textarea id="platform-description" className="min-h-24 w-full rounded-xl border p-3" maxLength={5000} value={form.description} onChange={e => change({ description: e.target.value })} /></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>开放地区与客户类型</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2"><Label htmlFor="platform-regions">开放国家或地区代码</Label><Input id="platform-regions" value={regionText} placeholder="SG, HK" onChange={e => { setRegionText(e.target.value); setDirty(true) }} /></div>
        <div className="flex flex-wrap gap-5">{TYPES.map(item => <label key={item.value} className="flex items-center gap-2"><input type="checkbox" checked={form.investorTypes.includes(item.value)} onChange={e => change({ investorTypes: e.target.checked ? [...form.investorTypes, item.value] : form.investorTypes.filter(x => x !== item.value) })} />{item.label}</label>)}</div>
        <p className="text-sm text-text-secondary">投资准入使用后台核验过的用户地区与客户类型。用户自行修改资料不会改变已核验结论。</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>官方渠道</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">只填写已验证的 HTTPS 官方链接。客服邮箱沿用上方主体资料。</p>
        <Button variant="outline" onClick={() => change({ officialChannels: [...form.officialChannels, { kind: 'website', label: '官方网站', url: '', note: '' }] })}>添加渠道</Button>
        {form.officialChannels.map((channel, index) => <div key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[140px_1fr_1fr_auto]">
          <select aria-label="渠道类型" className="rounded-xl border px-3" value={channel.kind} onChange={e => change({ officialChannels: form.officialChannels.map((item, i) => i === index ? { ...item, kind: e.target.value as typeof channel.kind } : item) })}>
            <option value="website">网站</option><option value="x">X</option><option value="telegram">Telegram</option><option value="linkedin">LinkedIn</option><option value="discord">Discord</option><option value="other">其他</option>
          </select>
          <Input aria-label="渠道名称" placeholder="展示名称" maxLength={80} value={channel.label} onChange={e => change({ officialChannels: form.officialChannels.map((item, i) => i === index ? { ...item, label: e.target.value } : item) })} />
          <Input aria-label="官方链接" type="url" placeholder="https://" maxLength={500} value={channel.url} onChange={e => change({ officialChannels: form.officialChannels.map((item, i) => i === index ? { ...item, url: e.target.value } : item) })} />
          <Button variant="outline" onClick={() => change({ officialChannels: form.officialChannels.filter((_, i) => i !== index) })}>移除</Button>
          <Input aria-label="渠道说明" className="sm:col-span-4" placeholder="可选说明，例如：不会主动私信索取密钥" maxLength={240} value={channel.note} onChange={e => change({ officialChannels: form.officialChannels.map((item, i) => i === index ? { ...item, note: e.target.value } : item) })} />
        </div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>授权、条款与证明文件</CardTitle></CardHeader><CardContent className="space-y-4">
        <Button variant="outline" onClick={() => setPickerOpen(true)}>从已校验文件库选择</Button>
        <StoragePicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={object => {
          change({ documents: [...form.documents, { title: object.key.split('/').pop() ?? '文件', storageRef: object.storageRef, public: false }] })
          setPickerOpen(false)
        }} />
        <StorageUpload bucket="rwa-assets" purpose="disclosure" label="上传 PDF 或图片" onDone={object => {
          if (object.scanStatus !== 'clean') { setFailed(true); setNotice('文件已上传，校验通过后才能关联。'); return }
          change({ documents: [...form.documents, { title: object.key.split('/').pop() ?? '文件', storageRef: object.storageRef, public: false }] })
        }} />
        <p className="text-sm text-text-secondary">新文件默认仅后台可见。只有勾选“公开”并发布的文件才出现在用户端。</p>
        {form.documents.map((doc, index) => <div key={`${doc.storageRef}-${index}`} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <Input aria-label="文件展示名称" className="min-w-48 flex-1" value={doc.title} onChange={e => change({ documents: form.documents.map((d, i) => i === index ? { ...d, title: e.target.value } : d) })} />
          <select aria-label="文件用途" className="rounded-xl border p-2" value={doc.kind ?? 'general'} onChange={e => change({documents:form.documents.map((d,i)=>i===index ? {...d,kind:e.target.value as 'general'|'reserve_audit'|'reserve_custody'} : d)})}><option value="general">一般资料</option><option value="reserve_audit">储备审计报告</option><option value="reserve_custody">储备托管证明</option></select>
          {doc.kind && doc.kind !== 'general' && <div className="grid w-full gap-3 sm:grid-cols-3"><label>报告日期<Input aria-label="报告日期" type="date" value={doc.reportDate ?? ''} onChange={e=>change({documents:form.documents.map((d,i)=>i===index ? {...d,reportDate:e.target.value} : d)})} /></label><label>统计截至日期<Input aria-label="统计截至日期" type="date" value={doc.asOfDate ?? ''} onChange={e=>change({documents:form.documents.map((d,i)=>i===index ? {...d,asOfDate:e.target.value} : d)})} /></label><label>出具机构<Input aria-label="报告出具机构" maxLength={160} value={doc.issuer ?? ''} onChange={e=>change({documents:form.documents.map((d,i)=>i===index ? {...d,issuer:e.target.value} : d)})} /></label></div>}
          <label className="flex items-center gap-2"><input type="checkbox" checked={doc.public} onChange={e => change({ documents: form.documents.map((d, i) => i === index ? { ...d, public: e.target.checked } : d) })} />公开</label>
          <Button variant="outline" onClick={() => change({ documents: form.documents.filter((_, i) => i !== index) })}>移除关联</Button>
        </div>)}
      </CardContent></Card>
    </fieldset>
    {regions && <Card><CardHeader><CardTitle>用户地区与客户类型核验</CardTitle></CardHeader><CardContent className="space-y-3">
      <Input aria-label="用户编号" placeholder="用户 UUID" value={userId} disabled={busy} onChange={e => { setUserId(e.target.value); setAccess(EMPTY_ACCESS) }} />
      <Input aria-label="核验地区" placeholder="经核验的两位地区代码" value={access.region} maxLength={2} onChange={e => setAccess({ ...access, region: e.target.value.toUpperCase() })} />
      <select aria-label="客户类型" className="w-full rounded-xl border p-2" value={access.investorType} onChange={e => setAccess({ ...access, investorType: e.target.value })}>{TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      <Input aria-label="核验依据" placeholder="核验记录或文件编号" value={access.evidenceRef} onChange={e => setAccess({ ...access, evidenceRef: e.target.value })} />
      <div className="flex gap-3"><Button variant="outline" disabled={busy || !userId} onClick={() => void act(async () => { const value = await adminApi.getVerifiedAccess(userId); setAccess(value ?? EMPTY_ACCESS); setNotice(value ? '已读取核验记录' : '暂无核验记录') })}>查询</Button><Button disabled={busy || !userId} onClick={() => void act(async () => { const { region, investorType, evidenceRef } = access; setAccess(await adminApi.saveVerifiedAccess(userId, { region, investorType, evidenceRef })); setNotice('核验结果已保存并记录操作人') })}>保存核验结论</Button></div>
    </CardContent></Card>}
    <Card><CardHeader><CardTitle>发布历史</CardTitle></CardHeader><CardContent>{versions.length ? versions.map(v => <p key={v.revision} className="py-1 text-sm">版本 {v.revision} · {new Date(v.publishedAt).toLocaleString()}</p>) : <p className="text-sm text-text-secondary">暂无发布记录</p>}</CardContent></Card>
  </div></AdminLayout>
}
