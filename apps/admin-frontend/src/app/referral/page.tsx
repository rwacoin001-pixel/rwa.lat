'use client'
import { adminErrorMessage } from '@/lib/admin-errors'
import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, Panel, RefreshButton, StatChip, useApi, formatDateTime } from '@/components/console/framework'

type Config={feeRatesBps:number[];holdingRatesBps:number[];teamTiers:Array<{fromAtomic:string;toAtomic:string|null;rateBps:number}>;[key:string]:unknown}
type Version={version:number;config:Config;created_at:string;fee_effective_at:string;holding_effective_at:string;team_effective_at:string}
type Overview={counts:{bindings:number;events:number;awards:number;pendingReview:number};audit:{items:Array<{id:string;action:string;actorId:string|null;createdAt:string}>;total:number}}
const labels:Record<string,string>={feeEnabled:'手续费奖励规则',holdingEnabled:'持仓奖励规则',teamEnabled:'团队奖励规则',attributionDays:'归因窗口（天）',teamDepth:'团队层级',dailyRiskAtomic:'单用户每日待审阈值（USDT 原子单位）',monthlyRiskMultiple:'月度风险倍数',zeroBaselineRiskAtomic:'无历史基线阈值（USDT 原子单位）',withdrawalReviewAtomic:'大额提现待审阈值（USDT 原子单位）',costObservationBps:'成本观察比例（bps）',defaultClaimDestination:'默认领取方式'}
export default function ReferralPage() {
  const [page,setPage]=useState(1),[draft,setDraft]=useState<Config|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmVersion,setConfirmVersion]=useState<number|null>(null)
  const versions=useApi<Version[]>('/api/admin/referral/settings')
  const overview=useApi<Overview>(`/api/admin/referral/overview?page=${page}&pageSize=20`)
  const reconciliation=useApi<{mappedAccounts:number;discrepancyCount:number}>('/api/admin/referral/reconciliation')
  const current=versions.data?.[0], config=draft??current?.config
  const reload=()=>{versions.reload();overview.reload();reconciliation.reload()}
  const update=(key:string,value:unknown)=>{if(config)setDraft({...config,[key]:value})}
  const mutate=async(path:string,body:unknown)=>{
    setBusy(true);setMessage('')
    try {const response=await fetch(`/api/admin/referral/settings/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)})
      const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(adminErrorMessage(result,response.status))
      setDraft(null);setConfirmVersion(null);setMessage(`已创建版本 ${result.version}，历史记录保持原样`);reload()
    }catch(e){setMessage(e instanceof Error?e.message:'操作失败')}finally{setBusy(false)}
  }
  return <AdminLayout><div className="space-y-6"><PageHeader title="推荐奖励" subtitle="归因 · 规则版本 · 审计" actions={<RefreshButton loading={versions.loading||overview.loading} onClick={reload}/>}/>
    <div className="glass-strong rounded-xl p-4 text-sm">发放关闭 · 尚未接入真实收费事件 · 成本只统计，不执行预算缩水</div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[['绑定用户',overview.data?.counts.bindings],['来源事件',overview.data?.counts.events],['候选权益',overview.data?.counts.awards],['待审核',overview.data?.counts.pendingReview]].map(([label,value])=><StatChip key={String(label)} label={String(label)} value={value??'—'}/>)}</div>
    {[versions.error,overview.error,reconciliation.error].filter(Boolean).map((error,i)=><p key={i} role="alert" className="text-sm text-red-500">{error}</p>)}
    {message&&<p role="status" className="rounded-xl border p-3 text-sm">{message}</p>}
    {config&&<Panel title={`规则配置 · v${current?.version}`} subtitle="保存生成新版本：手续费立即生效，持仓次日生效，团队次月生效。规则开关不等于发放开关。">
      <form onSubmit={e=>{e.preventDefault();void mutate('save',{config})}} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">{Object.entries(labels).map(([key,label])=><label key={key} className="space-y-2 text-sm"><span className="block">{label}</span>{typeof config[key]==='boolean'?<input type="checkbox" checked={config[key] as boolean} disabled={busy} onChange={e=>update(key,e.target.checked)}/>:key==='defaultClaimDestination'?<select className="w-full rounded-lg border bg-transparent p-2" value={String(config[key])} onChange={e=>update(key,e.target.value)}><option value="credit">额度</option><option value="cash">现金</option></select>:<input className="w-full rounded-lg border bg-transparent p-2" type={typeof config[key]==='number'?'number':'text'} pattern={typeof config[key]==='string'?'[0-9]+':undefined} required min={key==='attributionDays'||key==='teamDepth'?1:0} max={key==='attributionDays'?30:key==='teamDepth'?3:undefined} value={String(config[key])} onChange={e=>update(key,typeof config[key]==='number'?Number(e.target.value):e.target.value)}/>}</label>)}</div>
        {(['feeRatesBps','holdingRatesBps'] as const).map(key=><fieldset key={key}><legend className="mb-2 text-sm">{key==='feeRatesBps'?'手续费分成':'持仓年化'}（bps，100 bps = 1%）</legend><div className="grid grid-cols-3 gap-3">{config[key].map((rate,i)=><label key={i} className="text-xs">第 {i+1} 级<input aria-label={`${key} 第 ${i+1} 级`} type="number" min={0} max={10000} step={1} required className="mt-2 w-full rounded-lg border bg-transparent p-2" value={rate} onChange={e=>update(key,config[key].map((v,j)=>i===j?Number(e.target.value):v))}/></label>)}</div></fieldset>)}
        <fieldset><legend className="mb-2 text-sm">团队累进阶梯 · USDT 原子单位（1 USDT = 1000000）</legend>{config.teamTiers.map((tier,i)=><div key={i} className="mb-3 grid grid-cols-3 gap-3">{(['fromAtomic','toAtomic','rateBps'] as const).map(key=><label key={key} className="text-xs">{key==='fromAtomic'?'起点':key==='toAtomic'?'终点':'比例 bps'}<input aria-label={`阶梯 ${i+1} ${key}`} className="mt-2 w-full rounded-lg border bg-transparent p-2" type={key==='rateBps'?'number':'text'} pattern={key==='rateBps'?undefined:'[0-9]+'} required={tier[key]!==null} disabled={key==='toAtomic'&&tier.toAtomic===null} value={tier[key]??'无限'} min={0} max={key==='rateBps'?10000:undefined} onChange={e=>update('teamTiers',config.teamTiers.map((v,j)=>i===j?{...v,[key]:key==='rateBps'?Number(e.target.value):e.target.value}:v))}/></label>)}</div>)}</fieldset>
        <div className="flex gap-3"><button type="submit" disabled={busy||!draft} className="rounded-xl bg-ink px-5 py-2 text-white disabled:opacity-40">保存新版本</button><button type="button" onClick={()=>setDraft(null)} disabled={busy} className="rounded-xl border px-5 py-2">放弃修改</button></div>
      </form></Panel>}
    <Panel title="规则历史"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['版本','创建','手续费生效','持仓生效','团队生效','操作'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{versions.data?.map(v=><tr key={v.version} className="border-t"><td className="p-3">v{v.version}</td><td>{formatDateTime(v.created_at)}</td><td>{formatDateTime(v.fee_effective_at)}</td><td>{formatDateTime(v.holding_effective_at)}</td><td>{formatDateTime(v.team_effective_at)}</td><td><button disabled={busy||v.version===current?.version} onClick={()=>setConfirmVersion(v.version)} className="underline disabled:opacity-40">恢复此配置</button></td></tr>)}</tbody></table></div>{confirmVersion!==null&&<div role="alertdialog" aria-label="恢复历史配置" className="mt-3 rounded-xl border p-4 text-sm">恢复 v{confirmVersion} 将创建新版本，历史奖励不重算。<div className="mt-3 flex gap-4"><button disabled={busy} onClick={()=>void mutate('rollback',{version:confirmVersion})}>确认恢复</button><button onClick={()=>setConfirmVersion(null)}>取消</button></div></div>}</Panel>
    <Panel title="账本与额度对账"><p className="text-sm">{reconciliation.data?`映射账户 ${reconciliation.data.mappedAccounts} · 差异 ${reconciliation.data.discrepancyCount}`:reconciliation.loading?'正在核对…':'未取得对账结果'}</p></Panel>
    <Panel title="操作审计"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-3">操作</th><th>操作人</th><th>时间</th></tr></thead><tbody>{overview.data?.audit.items.map(a=><tr key={a.id} className="border-t"><td className="p-3">{a.action}</td><td>{a.actorId?.slice(0,8)??'系统'}</td><td>{formatDateTime(a.createdAt)}</td></tr>)}</tbody></table></div>{overview.data?.audit.total===0&&<p className="p-4 text-sm text-muted-foreground">暂无操作记录</p>}<div className="mt-4 flex justify-between text-sm"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{page}</span><button disabled={!overview.data||page*20>=overview.data.audit.total} onClick={()=>setPage(p=>p+1)}>下一页</button></div></Panel>
  </div></AdminLayout>
}
