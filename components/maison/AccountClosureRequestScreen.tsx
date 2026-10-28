'use client'
import {useState} from 'react'
import {request} from '@/lib/api/_http'
import {useQuery} from '@/lib/api/_query'
import {useI18n} from '@/lib/i18n'
import {backOr,openPath} from '@/lib/maison-nav'
import RwaTopbar from '../rwa-topbar'
import {MaisonPage,Skeleton,StateBlock,maison as s} from './primitives'

type Closure = {id:string;state:string;reason:string;reviewNote:string|null;createdAt:string}
type Status = {requests:Closure[];blockers:{code:string;count:number}[]}
const labels:Record<string,[string,string]>={balances:['账户余额','Account balances'],positions:['持仓','Holdings'],orders:['投资申请','Investment requests'],redemptions:['赎回','Redemptions'],withdrawals:['提现','Withdrawals'],deposits:['待处理充值','Pending deposits'],transfers:['转账','Transfers'],recurring:['执行中的定投','Active recurring plans'],rebalances:['再平衡','Rebalances'],trading:['交易订单','Trading orders'],subscriptions:['有效订阅','Active subscriptions'],yields:['待入账派息','Pending yield'],basketPending:['组合申请','Basket requests'],basketHoldings:['组合持仓','Basket holdings']}
const states:Record<string,[string,string]>={requested:['待管理员核查','Awaiting administrator review'],rejected:['已拒绝','Rejected'],closed:['已关闭','Closed'],canceled:['已撤回','Canceled']}
export function AccountClosureRequestScreen(){
  const {locale}=useI18n();const cn=locale==='zh-CN',index=cn?0:1
  const query=useQuery('account-closure',()=>request<Status>('/v1/account-closure'))
  const [reason,setReason]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const pending=query.data?.requests.find(r=>r.state==='requested')
  const submit=async(id?:string)=>{
    if(busy)return;setBusy(true);setError('')
    const result=await request<Status>(id?`/v1/account-closure/${id}/cancel`:'/v1/account-closure',{method:'POST',...(id?{}:{body:JSON.stringify({reason:reason.trim()})})})
    setBusy(false);if(!result.ok){setError(result.error.message);return}setReason('');setConsent(false);query.refetch()
  }
  return <MaisonPage page="close-account" topbar={<RwaTopbar screen="close-account" title={cn?'申请关闭账户':'Request account closure'} onBack={()=>backOr('/profile')}/>}><header className={s.hero}><h1 className={s.display}>{cn?'关闭账户申请':'Account closure request'}</h1><p className={s.lede}>{cn?'提交申请后由管理员核查余额、持仓和未结事项。提交申请本身不会关闭账户或转移资金。':'Administrators check balances, holdings and unsettled operations. Applying does not close the account or move funds.'}</p></header>
    {error&&<p role="alert">{error}</p>}{query.error?<StateBlock tone="error" title={query.error.message} retry={query.refetch}/>:!query.data?<Skeleton rows={4}/>:<>
    <h2>{cn?'关闭前待处理事项':'Items to resolve before closure'}</h2>{query.data.blockers.length?<ul>{query.data.blockers.map(b=><li key={b.code}>{labels[b.code]?.[index]??b.code}: {b.count}</li>)}</ul>:<p>{cn?'当前未发现资金与申请阻塞项，最终以管理员处理时重新核查为准。':'No financial blockers currently found. Checks run again when the administrator handles the request.'}</p>}
    <button className={s.ghost} onClick={()=>openPath('/assets')}>{cn?'查看资产与交易':'Review assets and activity'}</button>
    <p>{cn?'关闭后仍收到的充值会进入异常待处理，由管理员核实并人工安排退回；不会自动恢复账户。账户与交易记录按运营政策保留。':'Deposits received after closure require manual review and refund handling. They do not reopen the account. Account and transaction records are retained under the operator’s policy.'}</p>
    {pending?<div role="status"><h2>{states.requested[index]}</h2><p>{pending.reason}</p><button className={s.ghost} disabled={busy} onClick={()=>void submit(pending.id)}>{cn?'撤回关闭申请':'Cancel closure request'}</button></div>:<form onSubmit={e=>{e.preventDefault();void submit()}}><label>{cn?'申请原因':'Reason'}<textarea className={s.planningInput} required maxLength={1000} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)}/></label><label className={s.consent}><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>{cn?'我理解这只是提交申请，仍需管理员核查处理。':'I understand this is an application and requires administrator review.'}</label><button className={s.cta} disabled={busy||!consent||!reason.trim()}>{cn?'提交关闭申请':'Submit closure request'}</button></form>}
    <h2>{cn?'申请记录':'Request history'}</h2><ul className={s.list}>{query.data.requests.map(r=><li key={r.id} style={{padding:'16px 0'}}><b>{states[r.state]?.[index]??r.state}</b><p>{r.reason}</p>{r.reviewNote&&<p>{r.reviewNote}</p>}<small>{new Date(r.createdAt).toLocaleString(locale)}</small></li>)}</ul></>}
  </MaisonPage>
}
