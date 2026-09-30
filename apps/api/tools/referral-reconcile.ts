import 'dotenv/config'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../src/database/database-options'
import { ReferralFoundationService } from '../src/referral/referral-foundation.service'

async function main() {
  const ds=new DataSource(buildDatabaseOptions(process.env))
  await ds.initialize()
  try {
    const q=ds.createQueryRunner();await q.connect();await q.startTransaction()
    try {
      await q.query('SET TRANSACTION READ ONLY')
      const exists=await q.query(`SELECT to_regclass('app.referral_credit_accounts') IS NOT NULL AS installed`)
      if(!exists[0].installed){console.log(JSON.stringify({installed:false,discrepancyCount:null}));process.exitCode=2;return}
      // Use the same snapshot and connection as the read-only transaction.
      const result=await new ReferralFoundationService({query:q.query.bind(q)} as unknown as DataSource).reconcile()
      console.log(JSON.stringify({installed:true,...result})); if(result.discrepancyCount)process.exitCode=1
    } finally {await q.rollbackTransaction();await q.release()}
  } finally {await ds.destroy()}
}
main().catch(()=>{console.error('Referral reconciliation unavailable');process.exitCode=1})
