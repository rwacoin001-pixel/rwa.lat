'use client'
import { useRef, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, Panel, useApi } from '@/components/console/framework'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StoragePicker } from '@/components/storage-picker'

type Kind='trade_confirmation'|'statement'|'agreement'|'tax_document'
type Company={companyName:string;registration:string;contact:string;website:string}
type Template={title:string;introduction:string;terms:string[];enabled:boolean}
type Config={company:{revision:number;content:Company};templates:{kind:Kind;revision:number;content:Template}[]}
const labels:Record<Kind,string>={trade_confirmation:'成交确认书',statement:'账户结单',agreement:'投资服务协议',tax_document:'税务文件'}
const taxEmpty={userId:'',taxYear:new Date().getUTCFullYear()-1,accountHolder:'',taxpayerId:'',taxResidency:'',jurisdiction:'',taxpayerAddress:'',currency:'USDT',decimals:6,gross:'',withheld:'',incomeDescription:'',evidenceRef:'',verified:false}
function toAtomic(value:string,decimals:number){
  if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw new Error('报告精度须为 0–18 的整数')
  if(!/^\d{1,30}(\.\d{1,18})?$/.test(value.trim()))throw new Error('金额须为非负数字')
  const [whole,fraction='']=value.trim().split('.')
  if(fraction.length>decimals)throw new Error(`金额超出报告的 ${decimals} 位精度，请核实原始资料，不会自动四舍五入`)
  const atomic=(BigInt(whole)*BigInt(10)**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0')).toString()
  if(atomic.length>30)throw new Error('金额超出可录入范围')
  return atomic
}

export default function DocumentTemplatesPage(){
  const config=useApi<Config>('/api/admin/document-templates')
  const issued=useApi<{id:string;userId:string;kind:Kind;state:string;title:string;scanStatus:string|null}[]>('/api/admin/document-templates/issued')
  const [company,setCompany]=useState<{revision:number;content:Company}|null>(null)
  const [selected,setSelected]=useState<{kind:Kind;revision:number;content:Template}|null>(null)
  const [terms,setTerms]=useState('')
  const [versions,setVersions]=useState<{revision:number;content:Template;createdAt:string}[]>([])
  const [tax,setTax]=useState(taxEmpty),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false)
  const [proofPicker,setProofPicker]=useState(false)
  const intent=useRef<string|null>(null)
  async function action(path:string,body:unknown){
    if(busy) return false
    setBusy(true);setMessage('');setFailed(false)
    try{const response=await fetch(`/api/admin/document-templates${path}`,{method:'POST',headers:{'content-type':'application/json'},credentials:'include',body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.message??data.error?.message??'操作失败');config.reload();issued.reload();setMessage('已保存。文件生成和扫描完成后可下载。');return true}
    catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'操作失败');return false}finally{setBusy(false)}
  }
  async function history(kind:Kind){setVersions([]);try{const response=await fetch(`/api/admin/document-templates/${kind}/versions`,{credentials:'include'});const data=await response.json();if(!response.ok)throw new Error(data.message??'读取版本失败');setVersions(data)}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'读取失败')}}
  async function issueTax(){try{if(!intent.current)intent.current=crypto.randomUUID();if(await action('/tax-records',{...tax,gross:undefined,withheld:undefined,grossAtomic:toAtomic(tax.gross,tax.decimals),withheldAtomic:toAtomic(tax.withheld,tax.decimals),idempotencyKey:intent.current})){intent.current=null;setTax(taxEmpty)}}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'金额错误')}}
  function updateTax(patch:Partial<typeof tax>){setTax(current=>({...current,...patch}));intent.current=null}
  return <AdminLayout><div className="space-y-5"><PageHeader title="正式文件模板" subtitle="统一公司名称、保留历史版本；成交、结单、协议与税务文件自动生成 PDF。"/>
    {message&&<p role={failed?'alert':'status'}>{message}</p>}{config.error&&<p role="alert">{config.error}<Button onClick={config.reload}>重试</Button></p>}
    <Panel title="统一主体"><p>公司名称默认 rwa.lat，修改一次即可用于后续文件；已发放文件保留原主体。</p>{config.data&&!company&&<Button onClick={()=>setCompany(config.data!.company)}>编辑公司名称与资料</Button>}{company&&<fieldset disabled={busy} className="space-y-3 border-0">{(['companyName','registration','contact','website'] as const).map((key,index)=><label key={key} className="block">{['公司名称','真实主体注册信息','联系邮箱或电话','官方网站（HTTPS）'][index]}<Input value={company.content[key]} onChange={e=>setCompany({...company,content:{...company.content,[key]:e.target.value}})}/></label>)}<Button onClick={async()=>{if(await action('/company',{...company.content,expectedRevision:company.revision}))setCompany(null)}}>保存主体新版本</Button><Button variant="outline" onClick={()=>setCompany(null)}>取消编辑</Button></fieldset>}</Panel>
    <Panel title="模板编辑"><div className="flex flex-wrap gap-2">{config.data?.templates.map(row=><Button key={row.kind} variant="outline" disabled={busy||Boolean(selected)} onClick={()=>{setSelected(row);setTerms(row.content.terms.join('\n\n'));void history(row.kind)}}>{labels[row.kind]} · v{row.revision} · {row.content.enabled?'启用':'未启用'}</Button>)}</div>
      {selected&&<fieldset disabled={busy} className="mt-5 space-y-3 border-0"><label className="block">标题<Input value={selected.content.title} maxLength={200} onChange={e=>setSelected({...selected,content:{...selected.content,title:e.target.value}})}/></label><label className="block">说明<textarea className="w-full rounded-xl border p-3" rows={3} maxLength={3000} value={selected.content.introduction} onChange={e=>setSelected({...selected,content:{...selected.content,introduction:e.target.value}})}/></label><label className="block">条款（条款之间空一行）<textarea className="w-full rounded-xl border p-3" rows={10} value={terms} onChange={e=>setTerms(e.target.value)}/></label><label className="flex gap-2"><input type="checkbox" checked={selected.content.enabled} onChange={e=>setSelected({...selected,content:{...selected.content,enabled:e.target.checked}})}/>启用此模板；协议必须填写真实主体注册信息及正式条款。</label>
      <div className="rounded-xl border p-4"><p className="text-sm">排版内容预览</p><b>{company?.content.companyName??config.data?.company.content.companyName}</b><h2 className="my-3 text-xl">{selected.content.title}</h2><p className="whitespace-pre-wrap">{selected.content.introduction}</p><ol className="list-inside list-decimal">{terms.split(/\n\s*\n/).filter(Boolean).map((term,i)=><li key={i} className="my-3 whitespace-pre-wrap">{term}</li>)}</ol><p>文件编号、账户编号、生成时间、真实金额及流水由系统填写。此处为内容预览。</p></div>
      <div className="flex flex-wrap gap-2"><Button onClick={async()=>{if(await action(`/${selected.kind}/save`,{...selected.content,terms:terms.split(/\n\s*\n/).filter(Boolean),expectedRevision:selected.revision})){setSelected(null);setVersions([])}}}>保存新版本</Button><Button variant="outline" onClick={()=>{setSelected(null);setVersions([])}}>取消编辑</Button><Button variant="outline" onClick={async()=>{if(await action(`/${selected.kind}/reset`,{expectedRevision:selected.revision})){setSelected(null);setVersions([])}}}>恢复内置模板为新版本</Button></div>
      <p>历史版本（恢复会创建新版本，不覆盖存档）：</p>{versions.map(version=><div key={version.revision} className="flex flex-wrap items-center gap-3"><span>v{version.revision} · {version.content.title} · {new Date(version.createdAt).toLocaleString()}</span><Button variant="outline" disabled={version.revision===selected.revision} onClick={async()=>{if(await action(`/${selected.kind}/restore`,{sourceRevision:version.revision,expectedRevision:selected.revision})){setSelected(null);setVersions([])}}}>恢复此版本</Button></div>)}
      </fieldset>}
    </Panel>
    <Panel title="录入已核实的税务资料并生成 PDF"><p>保留原始报告币种与精度，不换汇、不推断税率。凭证须先上传并完成扫描。</p>
      <Button variant="outline" disabled={busy} onClick={()=>setProofPicker(true)}>上传或选择已扫描的税务依据</Button>
      <fieldset disabled={busy} className="mt-3 space-y-3 border-0">
        <label className="block">原始报告币种（如 USD、CNY、USDT）<Input value={tax.currency} maxLength={12} onChange={e=>updateTax({currency:e.target.value.toUpperCase()})}/></label>
        <label className="block">原始报告金额小数位（0–18）<Input type="number" min={0} max={18} step={1} value={tax.decimals} onChange={e=>updateTax({decimals:Number(e.target.value)})}/></label>
        {(['userId','accountHolder','taxpayerId','taxResidency','jurisdiction','taxpayerAddress','incomeDescription','gross','withheld'] as const).map((key,index)=><label key={key} className="block">{['用户账户编号','核实的账户持有人','税号','税务居民地区','税务辖区','地址（可留空）','收入统计口径',`实际收入总额（${tax.currency}）`,`实际预扣税额（${tax.currency}）`][index]}<Input value={tax[key]} onChange={e=>updateTax({[key]:e.target.value})}/></label>)}
        <p>核实资料凭证：{tax.evidenceRef.split('/').pop()||'尚未选择，请点击上方上传或选择资料。'}</p>
        <label className="block">税年<Input type="number" min={2000} max={2200} value={tax.taxYear} onChange={e=>updateTax({taxYear:Number(e.target.value)})}/></label>
        <label className="flex gap-2"><input type="checkbox" checked={tax.verified} onChange={e=>updateTax({verified:e.target.checked})}/>我已核实上述身份、税务资料、币种、精度、收入和预扣税额。</label><Button disabled={!tax.verified} onClick={()=>void issueTax()}>生成正式税务 PDF</Button>
      </fieldset>
    </Panel>
    <Panel title="已发放文件"><Button variant="outline" onClick={issued.reload}>刷新生成状态</Button>{issued.error&&<p role="alert">{issued.error}</p>}{issued.data?.map(row=><div key={row.id} className="my-3 border-b py-3"><b>{row.title}</b><p className="break-all">账户 {row.userId} · {row.state} · 扫描 {row.scanStatus??'尚未生成'}</p></div>)}{issued.data?.length===0&&<p>尚无已发放文件。</p>}</Panel>
    <StoragePicker open={proofPicker} onOpenChange={setProofPicker} bucket="rwa-attachments" purpose="misc" title="上传并选取核实税务资料的依据" onSelect={object=>{updateTax({evidenceRef:`${object.bucket}/${object.key}`});setProofPicker(false)}}/>
  </div></AdminLayout>
}
