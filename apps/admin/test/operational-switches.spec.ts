import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { AdminControlService } from '../src/admin-control.service'

describe('deposit switch administration', () => {
  function setup(config: Record<string, string>) {
    const audit = jest.fn().mockResolvedValue([])
    const service = new AdminControlService({ query: audit } as unknown as DataSource, new ConfigService(config))
    const query = jest.spyOn(service as any, 'query').mockResolvedValue([{ switchKey: 'wallet.deposits.crediting', enabled: true }])
    return { service, query, audit }
  }
  it('allows deposit enablement without either admin-side environment flag and records an audit', async () => {
    const { service, query, audit } = setup({ CORE_DATABASE_URL: 'postgres://unused', ADMIN_LIVE_OPERATIONS_ENABLED: 'false', CORE_PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false' })
    const switches = await service.listSwitches()
    expect(switches.find(s => s.key === 'wallet.deposits.crediting')?.canEnable).toBe(true)
    expect(switches.find(s => s.key === 'orders.acceptance')?.canEnable).toBe(false)
    await service.updateSwitch('wallet.deposits.crediting', { enabled: true, reason: 'operator enabled' }, 'admin')
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE app.operational_switches'), ['wallet.deposits.crediting', true, 'operator enabled', 'admin'])
    expect(audit).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app.audit_logs'), expect.arrayContaining(['admin.operations.switch_enabled']))
    await service.onModuleDestroy()
  })
  it('does not permit enablement when the Core database is unconfigured', async () => {
    const { service, query } = setup({})
    await expect(service.updateSwitch('wallet.deposits.crediting', { enabled: true, reason: 'operator enabled' }, 'admin')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'OPERATIONAL_SWITCH_ENVIRONMENT_BLOCKED' }) })
    expect(query).not.toHaveBeenCalled()
  })
  it('keeps withdrawal execution behind the two-person approval flow', async () => {
    const { service, query } = setup({ CORE_DATABASE_URL: 'postgres://unused', ADMIN_LIVE_OPERATIONS_ENABLED: 'true', CORE_WALLET_EXECUTION_ENABLED: 'true' })
    await expect(service.updateSwitch('wallet.withdrawals.execution', { enabled: true, reason: 'operator enabled' }, 'admin')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'OPERATIONAL_SWITCH_ENVIRONMENT_BLOCKED' }) })
    expect(query).not.toHaveBeenCalled()
    await service.onModuleDestroy()
  })
})
