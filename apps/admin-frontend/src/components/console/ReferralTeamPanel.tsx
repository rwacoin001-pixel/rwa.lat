'use client'
import { useState } from 'react'
import { adminErrorMessage } from '@/lib/admin-errors'
import { Panel, RefreshButton, formatDateTime, useApi } from './framework'

type Batch={id:string;month:string;status:'pending'|'approved'|'paid'|'cancelled';totalAtomic:string;approvedAt:string|null;paidAt:string|null}
type Result={enabled:boolean;activatedAt:string|null;items:Batch[]}
type Detail=Batch&{awards:Array<{userId:string;baseAtomic:string;amountAtomic:string}>}
const statusNames={pending:'待审核',approved:'待发放',paid:'已到账',cancelled:'已作废'}
const money=(value:string)=>(Number(value)/1e6).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:6})
function lastClosedMonth(){const d=new Date(Date.now()+8*3600000);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7)}

export function ReferralTeamPanel(){
  const data=useApi<Result>('/api/admin/referral/team/batches')
  const [month,setMonth]=useState(lastClosedMonth),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const [confirmation,setConfirmation]=useState<{batch:Batch;action:'approve'|'pay'}|null>(null)
  const detail=useApi<Detail>(confirmation?`/api/admin/referral/team/batches/${confirmation.batch.id}`:null)
  async function action(path:string,body:unknown={}){
    setBusy(true);setMessage('')
    try{
      const res=await fetch(`/api/admin/referral/team/${path}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)})
      const result=await res.json().catch(()=>null)
      if(!res.ok)throw new Error(adminErrorMessage(result,res.status))
      setConfirmation(null);setMessage(path==='generate'?'已生成月结批次，请核对后审核。':path.endsWith('approve')?'已审核，等待资金发放。':'已完成发放；重复提交不会再次入账。');data.reload()
    }catch(e){setMessage(e instanceof Error?e.message:'操作失败')}finally{setBusy(false)}
  }
  return <Panel title="团队月度结算" subtitle="北京时间自然月 · 净合格手续费 · 分段累进 · 不追补启用前记录">
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <p>{data.data?.activatedAt?`${data.data.enabled?'已启用':'当前关闭'} · 起算 ${formatDateTime(data.data.activatedAt)}`:'正在读取启用状态…'}</p>
      <RefreshButton loading={data.loading||busy} onClick={data.reload}/>
    </div>
    <p className="my-3 text-sm text-muted-foreground">月末自动生成待审批次，也可手动重算已结束月份。手续费冲正后须重新生成并审核；审核完成、已收手续费资金充足时才能发放，直接计入用户可用余额。</p>
    <form className="my-4 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void action('generate',{month})}}>
      <label className="text-sm">结算月份<input type="month" value={month} max={lastClosedMonth()} onChange={e=>setMonth(e.target.value)} required className="ml-3 rounded-lg border bg-transparent p-2"/></label>
      <button type="submit" disabled={busy||data.loading} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">生成／重算</button>
    </form>
    {data.error&&<p role="alert" className="text-sm text-red-500">{data.error}</p>}
    {message&&<p role="status" className="my-3 rounded-lg border p-3 text-sm">{message}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['月份','批次编号','奖励合计 USDT','状态','审核时间','到账时间','操作'].map(name=><th key={name} className="p-3">{name}</th>)}</tr></thead><tbody>{data.data?.items.map(batch=><tr key={batch.id} className="border-t"><td className="p-3">{batch.month}</td><td title={batch.id}>{batch.id.slice(0,8)}</td><td>{money(batch.totalAtomic)}</td><td>{statusNames[batch.status]}</td><td>{batch.approvedAt?formatDateTime(batch.approvedAt):'—'}</td><td>{batch.paidAt?formatDateTime(batch.paidAt):'—'}</td><td>{(batch.status==='pending'||batch.status==='approved')&&<button disabled={busy} className="underline disabled:opacity-40" onClick={()=>setConfirmation({batch,action:batch.status==='pending'?'approve':'pay'})}>{batch.status==='pending'?'审核此批次':'发放此批次'}</button>}</td></tr>)}</tbody></table></div>
    {data.data?.items.length===0&&<p className="py-4 text-sm text-muted-foreground">暂无已结束月份的结算批次。</p>}
    {confirmation&&<div role="alertdialog" aria-label="确认团队月结操作" className="mt-4 rounded-xl border p-4 text-sm"><p>{confirmation.batch.month} · {money(confirmation.batch.totalAtomic)} USDT · {confirmation.batch.id}</p><p className="my-2">{confirmation.action==='approve'?'请核对本月费用、资格及金额。确认后批次进入待发放。':'将从已收手续费资金中扣款，转入用户可用余额。确认发放前请核对金额。'}</p>
      {detail.loading?<p>正在读取个人奖励明细…</p>:detail.error?<p role="alert">{detail.error}</p>:detail.data&&<div className="my-3 max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>用户 ID</th><th>净手续费 USDT</th><th>奖励 USDT</th></tr></thead><tbody>{detail.data.awards.map(award=><tr key={award.userId} className="border-t"><td className="py-2 font-mono">{award.userId}</td><td>{money(award.baseAtomic)}</td><td>{money(award.amountAtomic)}</td></tr>)}</tbody></table>{!detail.data.awards.length&&<p>本月无合格奖励。</p>}</div>}
      <div className="flex gap-4"><button disabled={busy||detail.loading||!detail.data||!!detail.error||detail.data.id!==confirmation.batch.id} onClick={()=>void action(`${confirmation.batch.id}/${confirmation.action}`)}>{busy?'处理中…':'确认'}</button><button disabled={busy} onClick={()=>setConfirmation(null)}>取消</button></div></div>}
  </Panel>
}
