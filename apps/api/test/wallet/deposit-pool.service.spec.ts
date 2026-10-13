import 'reflect-metadata'
jest.mock('../../src/security/audit-log.entity', () => ({ AuditLog: class AuditLog {} }))
jest.mock('../../src/identity/identity-crypto.service', () => ({ IdentityCrypto: class IdentityCrypto {} }))
jest.mock('../../src/wallet/manual/manual-custody.entities', () => ({ DepositPoolAddress: class DepositPoolAddress {} }))
import type { DataSource, Repository } from 'typeorm'
import { DepositPoolService } from '../../src/wallet/manual/deposit-pool.service'
import type { DepositPoolAddress } from '../../src/wallet/manual/manual-custody.entities'
import type { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import type { AuditLog } from '../../src/security/audit-log.entity'

function service(dataSource: Partial<DataSource> = {}) {
  return new DepositPoolService(
    {} as Repository<DepositPoolAddress>,
    { insert: jest.fn() } as unknown as Repository<AuditLog>,
    dataSource as DataSource,
    { hmac: (value: string) => Buffer.from(value) } as unknown as IdentityCrypto,
  )
}

describe('DepositPoolService', () => {
  it('reads the returned row from TypeORM UPDATE results when assigning a candidate', async () => {
    const row = { id: 'pool-1', address_ciphertext: Buffer.from('encrypted-address'), encryption_key_version: 1 }
    const manager = { query: jest.fn().mockResolvedValue([[row], 1]) }
    await expect((service() as any).assignCandidate(manager, 'pool-1', 'user-1')).resolves.toEqual(row)
  })

  it('treats a lost assignment race as a conflict instead of a silent null', async () => {
    const manager = { query: jest.fn().mockResolvedValue([[], 0]) }
    await expect((service() as any).assignCandidate(manager, 'pool-1', 'user-1')).rejects.toMatchObject({
      response: { code: 'WALLET_ADDRESS_POOL_CONFLICT' },
    })
  })

  it('no longer generates addresses', async () => {
    await expect(service().generate()).rejects.toMatchObject({ response: { code: 'WALLET_ADDRESS_POOL_GENERATION_DISABLED' } })
  })

  it('rejects an empty upload and uploads over the limit', async () => {
    const pools = service()
    await expect(pools.importAddresses('admin', { network: 'tron', addresses: ['  '] }, 'r')).rejects.toMatchObject({ response: { code: 'WALLET_ADDRESS_INVALID' } })
    await expect(pools.importAddresses('admin', { network: 'tron', addresses: Array(1001).fill('T') }, 'r')).rejects.toMatchObject({ response: { code: 'WALLET_ADDRESS_INVALID' } })
  })

  it('rejects networks other than TRON', async () => {
    await expect(service().importAddresses('admin', { network: 'ethereum', addresses: ['0xabc'] }, 'r')).rejects.toMatchObject({ response: { code: 'WALLET_NETWORK_UNSUPPORTED' } })
  })
})
