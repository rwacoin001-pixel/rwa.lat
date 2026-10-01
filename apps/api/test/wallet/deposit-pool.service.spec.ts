import 'reflect-metadata'
jest.mock('../../src/security/audit-log.entity', () => ({ AuditLog: class AuditLog {} }))
jest.mock('../../src/identity/identity-crypto.service', () => ({ IdentityCrypto: class IdentityCrypto {} }))
jest.mock('../../src/wallet/manual/manual-custody.entities', () => ({ DepositPoolAddress: class DepositPoolAddress {} }))
import type { DataSource, Repository } from 'typeorm'
import { DepositPoolService } from '../../src/wallet/manual/deposit-pool.service'
import type { DepositPoolAddress } from '../../src/wallet/manual/manual-custody.entities'
import type { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import type { AuditLog } from '../../src/security/audit-log.entity'

describe('DepositPoolService', () => {
  it('reads the returned row from TypeORM UPDATE results', async () => {
    const row = {
      id: 'pool-1',
      address_ciphertext: Buffer.from('encrypted-address'),
      encryption_key_version: 1,
    }
    const manager = {
      query: jest.fn().mockResolvedValue([[row], 1]),
    }
    const service = new DepositPoolService(
      {} as Repository<DepositPoolAddress>,
      {} as Repository<AuditLog>,
      {} as DataSource,
      {} as IdentityCrypto,
    )

    const result = await (service as any).claimAvailableAddress(manager, 'tron', 'user-1')

    expect(result).toEqual(row)
  })
})
