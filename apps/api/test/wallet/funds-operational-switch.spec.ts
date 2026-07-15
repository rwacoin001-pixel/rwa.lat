import { FundsOperationalSwitchService } from '../../src/wallet/funds-operational-switch.service'

function runnerWith(query: jest.Mock) {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query,
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  }
}

function serviceWith(query: jest.Mock) {
  const runner = runnerWith(query)
  const config = { get: (key: string) => {
    if (key === 'PRODUCTION_FINANCIAL_FEATURES_ENABLED' || key === 'WALLET_EXECUTION_ENABLED') return 'true'
    return undefined
  } }
  return {
    service: new FundsOperationalSwitchService({ createQueryRunner: () => runner } as never, config as never),
    runner,
  }
}

describe('FundsOperationalSwitchService', () => {
  it('lets one authorized administrator immediately pause execution', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT enabled, version FROM app.operational_switches')) return [{ enabled: true, version: 4 }]
      return []
    })
    const { service, runner } = serviceWith(query)

    await expect(service.pause('admin-1', 'custody incident', 'request-1')).resolves.toEqual({
      enabled: false, duplicate: false,
    })

    expect(query.mock.calls.some(([sql]) => String(sql).includes('SET enabled = false'))).toBe(true)
    expect(runner.commitTransaction).toHaveBeenCalled()
  })

  it('forbids the resume requester from approving their own request', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM app.operational_switch_change_requests')) {
        return [{ id: 'resume-1', state: 'requested', requested_by: 'admin-1', change_id: 'CHG-1' }]
      }
      return []
    })
    const { service, runner } = serviceWith(query)

    await expect(service.decideResume('resume-1', 'admin-1', true, 'request-2')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'WALLET_WITHDRAWAL_SWITCH_CONFLICT' }),
    })

    expect(runner.rollbackTransaction).toHaveBeenCalled()
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SET enabled = true'))).toBe(false)
  })

  it('enables execution only after a different administrator approves the change', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM app.operational_switch_change_requests')) {
        return [{ id: 'resume-1', state: 'requested', requested_by: 'admin-1', change_id: 'CHG-1' }]
      }
      return []
    })
    const { service, runner } = serviceWith(query)

    await expect(service.decideResume('resume-1', 'admin-2', true, 'request-3')).resolves.toEqual({
      id: 'resume-1', state: 'approved', enabled: true,
    })

    expect(query.mock.calls.some(([sql]) => String(sql).includes('SET enabled = true'))).toBe(true)
    expect(runner.commitTransaction).toHaveBeenCalled()
  })
})
