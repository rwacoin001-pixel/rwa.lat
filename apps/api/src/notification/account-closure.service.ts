import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'

@Injectable()
export class AccountClosureService {
  constructor(private readonly db:DataSource) {}
  private async blockers(em:Pick<EntityManager,'query'>,userId:string) {
    const [row]=await em.query(`SELECT
      (SELECT count(*)::int FROM app.ledger_accounts a JOIN app.ledger_account_balances b ON b.account_id=a.id WHERE a.user_id=$1 AND b.current_atomic_balance<>0) AS balances,
      (SELECT count(*)::int FROM app.positions WHERE user_id=$1 AND quantity_atomic_amount<>0) AS positions,
      (SELECT count(*)::int FROM app.orders WHERE user_id=$1 AND state NOT IN ('filled','failed','cancelled')) AS orders,
      (SELECT count(*)::int FROM app.redemptions WHERE user_id=$1 AND state NOT IN ('completed','failed','canceled')) AS redemptions,
      (SELECT count(*)::int FROM app.withdrawals WHERE user_id=$1 AND state NOT IN ('completed','rejected','failed','cancelled')) AS withdrawals,
      (SELECT count(*)::int FROM app.deposits WHERE user_id=$1 AND state NOT IN ('credited','rejected')) AS deposits,
      (SELECT count(*)::int FROM app.internal_transfers WHERE (sender_user_id=$1 OR recipient_user_id=$1) AND state NOT IN ('posted','rejected','reversed')) AS transfers,
      (SELECT count(*)::int FROM app.recurring_investments WHERE user_id=$1 AND state='active') AS recurring,
      (SELECT count(*)::int FROM app.rebalance_plans WHERE user_id=$1 AND state NOT IN ('completed','canceled')) AS rebalances,
      (SELECT count(*)::int FROM app.trading_orders WHERE user_id=$1 AND state NOT IN ('filled','cancelled','rejected')) AS trading,
      (SELECT count(*)::int FROM app.subscriptions WHERE user_id=$1 AND state NOT IN ('canceled','expired')) AS subscriptions,
      (SELECT count(*)::int FROM app.yield_allocations WHERE user_id=$1 AND state='pending') AS yields,
      (SELECT count(*)::int FROM app.basket_subscriptions WHERE user_id=$1 AND status NOT IN ('settled','failed','cancelled'))+
      (SELECT count(*)::int FROM app.basket_redemptions WHERE user_id=$1 AND status NOT IN ('settled','failed','cancelled')) AS basketPending,
      (SELECT count(*)::int FROM (SELECT portfolio_id,SUM(units) AS units FROM (
        SELECT portfolio_id,units_issued AS units FROM app.basket_subscriptions WHERE user_id=$1 AND status='settled'
        UNION ALL SELECT portfolio_id,-units FROM app.basket_redemptions WHERE user_id=$1 AND status='settled'
      ) movements GROUP BY portfolio_id HAVING SUM(units)<>0) holdings) AS basketHoldings`,[userId])
    return Object.entries(row as Record<string,number>).filter(([,count])=>count>0).map(([code,count])=>({code,count}))
  }
  async status(userId:string) {
    const requests=await this.db.query('SELECT id,state,reason,review_note AS "reviewNote",created_at AS "createdAt",reviewed_at AS "reviewedAt" FROM app.account_closure_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[userId])
    return {requests,blockers:await this.blockers(this.db,userId),lateDepositPolicy:'manual_review_and_manual_refund'}
  }
  async request(userId:string,reason:string) {
    if (!reason.trim()) throw new BadRequestException('Closure reason required')
    const [existing]=await this.db.query("SELECT id FROM app.account_closure_requests WHERE user_id=$1 AND state='requested'",[userId])
    if(existing) return this.status(userId)
    await this.db.query(`INSERT INTO app.account_closure_requests(user_id,reason) SELECT id,$2 FROM app.users WHERE id=$1 AND status<>'closed'
      ON CONFLICT(user_id) WHERE state='requested' DO NOTHING`,[userId,reason.trim()])
    return this.status(userId)
  }
  async cancel(userId:string,id:string) {
    if(!(await this.db.query("WITH changed AS (UPDATE app.account_closure_requests SET state='canceled',reviewed_at=now() WHERE id=$1 AND user_id=$2 AND state='requested' RETURNING id) SELECT id FROM changed",[id,userId])).length) throw new ConflictException('Request cannot be canceled')
    return this.status(userId)
  }
  async list() {
    return this.db.query('SELECT id,user_id AS "userId",state,reason,review_note AS "reviewNote",created_at AS "createdAt" FROM app.account_closure_requests ORDER BY created_at DESC LIMIT 100')
  }
  async inspect(id:string) {
    const [request]=await this.db.query('SELECT id,user_id AS "userId",state,reason FROM app.account_closure_requests WHERE id=$1',[id])
    if(!request) throw new NotFoundException('Closure request not found')
    return {...request,blockers:await this.blockers(this.db,request.userId)}
  }
  async review(id:string,decision:'close'|'reject',note:string,adminId:string) {
    if(!note.trim()) throw new BadRequestException('Review note required')
    return this.db.transaction(async em=>{
      const [request]=await em.query('SELECT * FROM app.account_closure_requests WHERE id=$1 FOR UPDATE',[id])
      if(!request)throw new NotFoundException('Closure request not found')
      if(request.state!=='requested')throw new ConflictException('Closure request already handled')
      if(decision==='close') {
        // Financial write triggers acquire SHARE on this same user row. This exclusive
        // lock waits for prior writes and prevents any later writes passing the check.
        const [user]=await em.query('SELECT status FROM app.users WHERE id=$1 FOR UPDATE',[request.user_id])
        if(!user||user.status==='closed')throw new ConflictException('Account is already closed or unavailable')
        const blockers=await this.blockers(em,request.user_id)
        if(blockers.length)throw new ConflictException({code:'ACCOUNT_CLOSURE_BLOCKED',message:'Resolve balances, holdings and unsettled operations before closing.',blockers})
        await em.query("UPDATE app.users SET status='closed',closed_at=now(),updated_at=now() WHERE id=$1",[request.user_id])
        await em.query("UPDATE app.sessions SET state='revoked',revoked_at=now(),revoke_reason='account_closed' WHERE user_id=$1 AND state='active'",[request.user_id])
      }
      const state=decision==='close'?'closed':'rejected'
      await em.query('UPDATE app.account_closure_requests SET state=$2,review_note=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1',[id,state,note.trim(),adminId])
      await em.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
        VALUES($1,'admin',$2,'account_closure.review','account_closure',$3,$4,$5::jsonb)`,[randomUUID(),adminId,id,randomUUID(),JSON.stringify({decision,note:note.trim(),lateDepositPolicy:'manual_review_and_manual_refund'})])
      return {id,state}
    })
  }
}
