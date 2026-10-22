import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { monthlyWindow, progressiveReward } from './referral-team.math'
type Basis = { user_id: string; base_atomic: string; active: boolean }

@Injectable()
export class ReferralTeamService {
  constructor(private readonly db: DataSource) {}
  async status() {
    const [ready] = await this.db.query(`SELECT to_regclass('app.referral_team_activation') IS NOT NULL AS ready`)
    if (!ready.ready) return { enabled: false, activatedAt: null }
    const [a] = await this.db.query(`SELECT a.activated_at,s.config FROM app.referral_team_activation a JOIN app.referral_settings s
      ON s.version=(SELECT version FROM app.referral_settings WHERE team_effective_at<=now() OR version=a.settings_version
        ORDER BY CASE WHEN version=a.settings_version THEN a.activated_at ELSE team_effective_at END DESC,version DESC LIMIT 1)`)
    return { enabled: a?.config.teamEnabled === true, activatedAt: a?.activated_at ?? null }
  }
  private async installed() {
    const [r] = await this.db.query(`SELECT to_regclass('app.referral_team_batches') IS NOT NULL AS ready`)
    if (!r.ready) throw new ServiceUnavailableException({ code: 'REFERRAL_TEAM_UNAVAILABLE', message: 'Team settlement is not installed.' })
  }
  private async plan(m: EntityManager, month: string) {
    let window: { start: string; end: string }
    try { window = monthlyWindow(month) } catch (e) { throw new BadRequestException(e instanceof Error ? e.message : 'Invalid month') }
    const [activation] = await m.query('SELECT activated_at,settings_version FROM app.referral_team_activation')
    if (!activation || new Date(activation.activated_at) >= new Date(window.end)) throw new ConflictException({ code: 'REFERRAL_TEAM_BEFORE_ACTIVATION', message: 'No historical team reward backfill.' })
    const start = new Date(Math.max(new Date(window.start).getTime(), new Date(activation.activated_at).getTime())).toISOString()
    const [s] = await m.query(`SELECT version,config FROM app.referral_settings WHERE team_effective_at<=$1 OR version=$2
      ORDER BY CASE WHEN version=$2 THEN $3::timestamptz ELSE team_effective_at END DESC,version DESC LIMIT 1`,[start,activation.settings_version,activation.activated_at])
    if (!s) throw new ConflictException('No effective team policy')
    const basis = await m.query(`SELECT user_id,base_atomic::text,active FROM app.referral_team_basis($1,$2,$3) ORDER BY user_id`,[start,window.end,JSON.stringify(s.config)]) as Basis[]
    const awards = basis.filter(r=>r.active && BigInt(r.base_atomic)>0n).map(r=>({ userId:r.user_id,baseAtomic:r.base_atomic,amountAtomic:progressiveReward(BigInt(r.base_atomic),s.config.teamTiers).toString() })).filter(r=>BigInt(r.amountAtomic)>0n)
    const sourceHash = createHash('sha256').update(JSON.stringify({ start,end:window.end,version:s.version,basis })).digest('hex')
    return { start,end:window.end,settingsVersion:s.version,sourceHash,awards,total:awards.reduce((n,r)=>n+BigInt(r.amountAtomic),0n).toString() }
  }
  private async view(m: EntityManager, id: string) {
    const [b] = await m.query(`SELECT id,month,status,total_atomic::text AS "totalAtomic",starts_at AS "startsAt",ends_at AS "endsAt",settings_version AS "settingsVersion",approved_by AS "approvedBy",approved_at AS "approvedAt",paid_at AS "paidAt",ledger_transaction_id AS "ledgerTransactionId" FROM app.referral_team_batches WHERE id=$1`,[id])
    if (!b) throw new NotFoundException('Team batch not found')
    const awards = await m.query(`SELECT user_id AS "userId",base_atomic::text AS "baseAtomic",amount_atomic::text AS "amountAtomic" FROM app.referral_team_awards WHERE batch_id=$1 ORDER BY user_id`,[id])
    return { ...b,awards }
  }
  async detail(id:string) {
    if(!/^[a-f0-9-]{36}$/i.test(id)) throw new BadRequestException('Invalid batch id')
    await this.installed()
    return this.db.transaction('REPEATABLE READ',m=>this.view(m,id))
  }
  async generateMonth(month: string, actorId?: string) {
    await this.installed()
    return this.db.transaction(async m=> {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`team-month:${month}`])
      const plan=await this.plan(m,month)
      const [old]=await m.query(`SELECT * FROM app.referral_team_batches WHERE month=$1 AND status<>'cancelled' FOR UPDATE`,[month])
      if(old && (old.status==='paid' || old.source_hash===plan.sourceHash)) return this.view(m,old.id)
      if(old) await m.query(`UPDATE app.referral_team_batches SET status='cancelled' WHERE id=$1`,[old.id])
      const [b]=await m.query(`INSERT INTO app.referral_team_batches(month,starts_at,ends_at,settings_version,source_hash,total_atomic) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[month,plan.start,plan.end,plan.settingsVersion,plan.sourceHash,plan.total])
      for(const a of plan.awards) await m.query(`INSERT INTO app.referral_team_awards(batch_id,user_id,base_atomic,amount_atomic) VALUES($1,$2,$3,$4)`,[b.id,a.userId,a.baseAtomic,a.amountAtomic])
      await this.audit(m,'team.generated',b.id,actorId,{month,totalAtomic:plan.total,awardCount:plan.awards.length,replaces:old?.id??null})
      return this.view(m,b.id)
    })
  }
  private async currentBatch(m: EntityManager,id:string) {
    if(!/^[a-f0-9-]{36}$/i.test(id)) throw new BadRequestException('Invalid batch id')
    const [month]=await m.query('SELECT month FROM app.referral_team_batches WHERE id=$1',[id])
    if(!month) throw new NotFoundException('Team batch not found')
    await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`team-month:${month.month}`])
    const [b]=await m.query('SELECT * FROM app.referral_team_batches WHERE id=$1 FOR UPDATE',[id])
    return b
  }
  private async requireFresh(m:EntityManager,b:any) {
    const p=await this.plan(m,b.month)
    if(p.sourceHash!==b.source_hash) throw new ConflictException({code:'REFERRAL_TEAM_STALE',message:'Fees or policy changed. Regenerate and review the month again.'})
  }
  async approve(id:string,actorId:string) {
    await this.installed()
    return this.db.transaction(async m=> {
      const b=await this.currentBatch(m,id)
      if(b.status==='approved'||b.status==='paid') return this.view(m,id)
      if(b.status!=='pending') throw new ConflictException('Only a current pending batch can be approved')
      await this.requireFresh(m,b)
      await m.query(`UPDATE app.referral_team_batches SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1`,[id,actorId])
      await this.audit(m,'team.approved',id,actorId,{month:b.month,totalAtomic:b.total_atomic})
      return this.view(m,id)
    })
  }
  async pay(id:string,actorId:string,requestKey:string) {
    if(!/^[A-Za-z0-9_-]{8,128}$/.test(requestKey)) throw new BadRequestException('A valid Idempotency-Key is required')
    await this.installed()
    try { return await this.db.transaction(async m=> {
      const b=await this.currentBatch(m,id)
      if(b.status==='paid') return this.view(m,id)
      if(b.status!=='approved') throw new ConflictException('Review and approve the batch before funding')
      await this.requireFresh(m,b)
      const awards=await m.query(`SELECT user_id,amount_atomic::text FROM app.referral_team_awards WHERE batch_id=$1 ORDER BY user_id`,[id]) as {user_id:string;amount_atomic:string}[]
      let transactionId:string|null=null
      if(BigInt(b.total_atomic)>0n) {
        const recipients:Array<{id:string;amount:string}>=[]
        for(const a of awards) {
          const [u]=await m.query(`SELECT status FROM app.users WHERE id=$1 FOR SHARE`,[a.user_id])
          if(u?.status!=='active') throw new ConflictException('A team recipient account is unavailable; resolve before funding')
          await m.query(`INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES('user',$1,'available','USDT',6,'credit') ON CONFLICT DO NOTHING`,[a.user_id])
          const [account]=await m.query(`SELECT id,state,normal_side FROM app.ledger_accounts WHERE user_id=$1 AND owner_type='user' AND purpose='available' AND asset_code='USDT' AND asset_decimals=6 AND network IS NULL FOR SHARE`,[a.user_id])
          if(account?.state!=='active'||account.normal_side!=='credit') throw new ConflictException('A team recipient balance is unavailable')
          await m.query(`INSERT INTO app.ledger_account_balances(account_id,current_atomic_balance) SELECT $1,0 WHERE NOT EXISTS(SELECT 1 FROM app.ledger_entries WHERE account_id=$1) ON CONFLICT DO NOTHING`,[account.id])
          recipients.push({id:account.id,amount:a.amount_atomic})
        }
        // Bets lock a customer balance before fee revenue. NOWAIT makes only this payout retry if any balance is busy.
        await m.query(`SELECT account_id FROM app.ledger_account_balances WHERE account_id=ANY($1::uuid[]) ORDER BY account_id FOR UPDATE NOWAIT`,[recipients.map(a=>a.id)])
        const [fund]=await m.query(`SELECT id,state,normal_side,allow_negative FROM app.ledger_accounts
          WHERE owner_type='platform' AND owner_reference='prediction_fee' AND purpose='fee_revenue' AND asset_code='USDT' AND asset_decimals=6 AND network IS NULL FOR SHARE`)
        const [budget]=fund?await m.query(`SELECT current_atomic_balance::text AS balance FROM app.ledger_account_balances WHERE account_id=$1 FOR UPDATE NOWAIT`,[fund.id]):[]
        if(!fund||fund.state!=='active'||fund.normal_side!=='credit'||fund.allow_negative||BigInt(budget?.balance??'0')<BigInt(b.total_atomic)) throw new ConflictException({code:'REFERRAL_TEAM_INSUFFICIENT_FUNDING',message:'Collected platform fee funding is insufficient.'})
        const [t]=await m.query(`INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,reason_code,actor_type,actor_id,effective_at,metadata)
          VALUES('referral_reward',$1,$2,'referral_team_batch',$3,'referral_team_monthly','admin',$4,now(),$5) RETURNING id`,[`referral-team:${id}`,requestKey,id,actorId,JSON.stringify({month:b.month,approvedBy:b.approved_by,settingsVersion:b.settings_version})])
        transactionId=t.id
        await m.query(`INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'debit',$3)`,[t.id,fund.id,b.total_atomic])
        for(const a of recipients) {
          await m.query(`INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'credit',$3)`,[t.id,a.id,a.amount])
        }
      }
      await m.query(`UPDATE app.referral_team_batches SET status='paid',paid_by=$2,paid_at=now(),ledger_transaction_id=$3 WHERE id=$1`,[id,actorId,transactionId])
      await this.audit(m,'team.paid',id,actorId,{month:b.month,totalAtomic:b.total_atomic,ledgerTransactionId:transactionId})
      return this.view(m,id)
    }) } catch(e) {
      if((e as {code?:string}).code==='55P03') throw new ConflictException({code:'REFERRAL_TEAM_BUSY',message:'A balance is processing another transaction. Retry this batch shortly.'})
      throw e
    }
  }
  private async audit(m:EntityManager,action:string,id:string,actorId:string|undefined,metadata:unknown) {
    await m.query(`INSERT INTO app.referral_audit(request_key,actor_id,action,object_id,metadata) VALUES($1,$2,$3,$4,$5)`,[`team:${action}:${id}:${randomUUID()}`,actorId??null,action,id,JSON.stringify(metadata)])
  }
  async list() { await this.installed(); const rows=await this.db.query(`SELECT id,month,status,total_atomic::text AS "totalAtomic",approved_at AS "approvedAt",paid_at AS "paidAt",created_at AS "createdAt" FROM app.referral_team_batches ORDER BY created_at DESC,id LIMIT 100`);return { ...await this.status(),items:rows } }
  async records(userId:string) { const status=await this.status(); if(!status.activatedAt)return {...status,items:[]};const items=await this.db.query(`SELECT b.month,b.status,a.base_atomic::text AS "baseAtomic",a.amount_atomic::text AS "amountAtomic",b.paid_at AS "paidAt",b.ledger_transaction_id AS "ledgerTransactionId" FROM app.referral_team_awards a JOIN app.referral_team_batches b ON b.id=a.batch_id WHERE a.user_id=$1 AND b.status<>'cancelled' ORDER BY b.month DESC LIMIT 24`,[userId]);return {...status,items} }
  async generateClosedMonths() {
    const status=await this.status()
    if(!status.activatedAt) return
    const start=new Date(status.activatedAt).getTime()+8*3600000, now=Date.now()+8*3600000
    const first=new Date(start), current=new Date(now)
    // Bounded catch-up of CLOSED months since activation, never pre-activation backfill or auto-payment.
    let y=first.getUTCFullYear(),m=first.getUTCMonth()
    for(let i=0;i<120;i++) {
      if(y>current.getUTCFullYear()||(y===current.getUTCFullYear()&&m>=current.getUTCMonth()))break
      await this.generateMonth(`${y}-${String(m+1).padStart(2,'0')}`)
      if(++m===12){m=0;y++}
    }
  }
}
