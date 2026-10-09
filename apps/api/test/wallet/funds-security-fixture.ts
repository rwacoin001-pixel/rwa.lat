import { randomBytes, randomUUID } from 'node:crypto'
import type { DataSource, QueryRunner } from 'typeorm'
import { WalletLedgerBridge } from '../../src/wallet/wallet-ledger.bridge'

export async function realDeposit(db: DataSource, userId: string, atomicAmount = '300000001', provider = 'manual-custody', credit = true) {
  let [wallet] = await db.query('SELECT id FROM app.custody_wallets WHERE user_id=$1 AND provider=$2', [userId, provider])
  if (!wallet) [wallet] = await db.query(`INSERT INTO app.custody_wallets (user_id,provider,provider_wallet_hash,provider_wallet_ciphertext,encryption_key_version,state,activated_at)
    VALUES ($1,$2,$3,$3,1,'active',now()) RETURNING id`, [userId, provider, randomBytes(32)])
  const [address] = await db.query(`INSERT INTO app.wallet_addresses (wallet_id,user_id,network,asset_code,asset_decimals,address_hash,address_ciphertext,encryption_key_version)
    VALUES ($1,$2,'tron','USDT',6,$3,$3,1) RETURNING id`, [wallet.id, userId, randomBytes(32)])
  const [chain] = await db.query(`INSERT INTO app.chain_transactions (network,transaction_hash,state,confirmation_count,confirmed_at,raw_reference)
    VALUES ('tron',$1,'confirmed',30,now(),$2) RETURNING id`, [randomBytes(32).toString('hex'), JSON.stringify({ eventId: `tron-watcher:${randomUUID()}` })])
  const [deposit] = await db.query(`INSERT INTO app.deposits (user_id,wallet_address_id,chain_transaction_id,asset_code,asset_decimals,atomic_amount,required_confirmations,state)
    VALUES ($1,$2,$3,'USDT',6,$4,20,'confirming') RETURNING id`, [userId, address.id, chain.id, atomicAmount])
  if (!credit) return { depositId: deposit.id as string, chainId: chain.id as string, transactionId: randomUUID(), walletId: wallet.id as string }
  await new WalletLedgerBridge(db).creditDeposit(deposit.id, userId, 'tron', atomicAmount, `test-deposit:${randomUUID()}`)
  const [transaction] = await db.query('SELECT id FROM app.ledger_transactions WHERE idempotency_key=$1', [`deposit:${deposit.id}`])
  return { depositId: deposit.id as string, chainId: chain.id as string, transactionId: transaction.id as string, walletId: wallet.id as string }
}
export async function reverseDeposit(runner: QueryRunner, transactionId: string) {
  const [reversal] = await runner.query(`INSERT INTO app.ledger_transactions (transaction_type,idempotency_key,request_id,reference_type,reference_id,reverses_transaction_id,actor_type,effective_at)
    VALUES ('reversal',$1,$1,'test_fixture',$2,$2,'service',now()) RETURNING id`, [`test-reversal:${randomUUID()}`, transactionId])
  await runner.query(`INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount)
    SELECT $1,account_id,CASE side WHEN 'debit' THEN 'credit' ELSE 'debit' END,atomic_amount FROM app.ledger_entries WHERE transaction_id=$2`, [reversal.id, transactionId])
}
