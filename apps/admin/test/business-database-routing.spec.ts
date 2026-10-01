import { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import { AdminService } from '../src/admin.service'

describe('Control-plane business database routing', () => {
  it('reads user and redemption records from Core instead of the administrator credential database', async () => {
    const adminQuery = jest.fn()
    const service = new AdminService({ query: adminQuery } as unknown as DataSource, new ConfigService({ CORE_DATABASE_URL: 'postgres://unused' }))
    const query = jest.spyOn((service as any).core, 'query')
      .mockResolvedValueOnce({ rows: [{ id: 'core-user' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'core-redemption' }] })
      .mockResolvedValueOnce({ rows: [{ state: 'requested', cnt: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'core-redemption' }] })
    try {
      expect(await service.listUsers()).toEqual([{ id: 'core-user' }])
      expect(await service.listRedemptions()).toEqual([{ id: 'core-redemption' }])
      expect(await service.countRedemptionsByState()).toEqual({ requested: 1 })
      expect(await service.getRedemption('core-redemption')).toEqual({ id: 'core-redemption' })
      expect(query).toHaveBeenCalledTimes(4)
      expect(adminQuery).not.toHaveBeenCalled()
    } finally { await service.onModuleDestroy() }
  })
  it('does not fall back to administrator business fixtures in production', () => {
    expect(() => new AdminService({} as DataSource, new ConfigService({ APP_ENV: 'production' }))).toThrow('Core database is required')
  })
})
