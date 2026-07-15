import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import { CustodyWebhookVerifier, canonicalJson } from '../../src/wallet/custody-webhook.verifier'
import type { CustodyAdapter } from '../../src/wallet/custody-adapter.interface'
import { StubCustodyAdapter } from '../../src/wallet/stub-custody.adapter'
import { WalletNetworkRegistry } from '../../src/wallet/wallet-network.registry'
import { WalletService } from '../../src/wallet/wallet.service'

function repo(overrides: Record<string, unknown> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((value: object) => ({ ...value })),
    save: jest.fn((value: object) => Promise.resolve(value)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    insert: jest.fn().mockResolvedValue({ identifiers: [] }),
    ...overrides,
  }
}

function buildService(options: { execution?: boolean; demoCredit?: boolean; adapter?: CustodyAdapter; secret?: string; financial?: boolean } = {}) {
  const wallets = repo()
  const addresses = repo()
  const chains = repo()
  const deposits = repo()
  const withdrawals = repo()
  const transfers = repo()
  const accounts = repo()
  const balances = repo()
  const withdrawalAddresses = repo()
  const withdrawalApprovals = repo()
  const devices = repo()
  const auditLogs = repo()
  const adapter = options.adapter ?? new StubCustodyAdapter()
  const secret = options.secret ?? 'test-wallet-webhook-secret'
  const config = {
    get: (key: string) => {
      if (key === 'WALLET_EXECUTION_ENABLED') return String(options.execution ?? false)
      if (key === 'DEMO_WALLET_CREDIT_ENABLED') return String(options.demoCredit ?? false)
      if (key === 'WALLET_WEBHOOK_SECRET') return secret
      if (key === 'PRODUCTION_FINANCIAL_FEATURES_ENABLED') return String(options.financial ?? false)
      if (key === 'APP_ENV') return 'development'
      return undefined
    },
  }
  const ledger = {
    creditDeposit: jest.fn(),
    createWithdrawalWithLock: jest.fn(),
    postInternalTransfer: jest.fn(),
    claimWithdrawalExecution: jest.fn(),
    recordWithdrawalBroadcast: jest.fn(),
    releaseWithdrawalExecutionLease: jest.fn(),
    recordWithdrawalApproval: jest.fn(),
    recordWithdrawalRejection: jest.fn(),
  }
  const ledgerService = {
    settleWithdrawal: jest.fn(),
    refundWithdrawal: jest.fn(),
  }
  const crypto = {
    encrypt: (value: string) => ({ ciphertext: Buffer.from(value), keyVersion: 1 }),
    decrypt: (value: Buffer) => value.toString(),
    hmac: (value: string) => Buffer.from(`hmac:${value}`),
  }
  const security = { assertRecentStepUp: jest.fn() }
  const fundsSwitch = { isWithdrawalExecutionEnabled: jest.fn().mockResolvedValue(true) }
  const service = new WalletService(
    wallets as never,
    addresses as never,
    chains as never,
    deposits as never,
    withdrawals as never,
    transfers as never,
    accounts as never,
    balances as never,
    withdrawalAddresses as never,
    withdrawalApprovals as never,
    devices as never,
    auditLogs as never,
    adapter,
    new WalletNetworkRegistry(),
    new CustodyWebhookVerifier(config as unknown as ConfigService),
    ledger as never,
    ledgerService as never,
    crypto as never,
    security as never,
    fundsSwitch as never,
    config as unknown as ConfigService,
  )
  return {
    service, wallets, addresses, chains, deposits, withdrawals, transfers, accounts, balances,
    withdrawalAddresses, withdrawalApprovals, devices, auditLogs, ledger, security, fundsSwitch, secret,
  }
}

describe('WalletService', () => {
  it('publishes three network policies while keeping the stub integration read-only', () => {
    const { service } = buildService()
    const response = service.listNetworks()
    expect(response.networks.map((network) => network.id)).toEqual(['tron', 'ethereum', 'arbitrum'])
    expect(response.networks.every((network) => network.configurationSource === 'demo-policy')).toBe(true)
    expect(response.integration).toMatchObject({ adapterMode: 'stub', executionEnabled: false, realFunds: false })
  })

  it('provisions a deterministic encrypted deposit address without enabling real funds', async () => {
    const { service, wallets, addresses } = buildService()
    wallets.save.mockImplementation(async (value: object) => value)
    addresses.save.mockImplementation(async (value: object) => value)

    const response = await service.depositAddress('00000000-0000-4000-8000-000000000001', 'arbitrum')

    expect(response.address).toMatch(/^0x[a-f0-9]{40}$/)
    expect(response.requiredConfirmations).toBeGreaterThan(0)
    expect(response.integration.executionEnabled).toBe(false)
    expect(wallets.save).toHaveBeenCalledTimes(1)
    expect(addresses.save).toHaveBeenCalledTimes(1)
  })

  it('re-provisions a Stub address without decrypting legacy demo wallet seed data', async () => {
    const adapter = new StubCustodyAdapter()
    const provisionWallet = jest.spyOn(adapter, 'provisionWallet')
    const { service, wallets, addresses } = buildService({ adapter })
    wallets.findOne.mockResolvedValue({
      id: 'legacy-demo-wallet',
      userId: '00000000-0000-4000-8000-000000000002',
      providerWalletCiphertext: Buffer.from('not-a-valid-encrypted-payload'),
      state: 'active',
    })

    const response = await service.depositAddress('00000000-0000-4000-8000-000000000002', 'arbitrum')

    expect(response.address).toMatch(/^0x[a-f0-9]{40}$/)
    expect(provisionWallet).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000002')
    expect(wallets.save).not.toHaveBeenCalled()
    expect(addresses.save).toHaveBeenCalledTimes(1)
  })

  it('quotes exact atomic amounts and reports insufficient balance without changing state', async () => {
    const { service, accounts, balances, ledger } = buildService()
    accounts.findOne.mockResolvedValue({ id: 'available-account' })
    balances.findOne.mockResolvedValue({ accountId: 'available-account', currentAtomicBalance: '10499999' })

    const quote = await service.quoteWithdrawal('user-1', { network: 'arbitrum', atomicAmount: '10000000' })

    expect(quote.totalDebitAtomic).toBe('10500000')
    expect(quote.sufficientBalance).toBe(false)
    expect(ledger.createWithdrawalWithLock).not.toHaveBeenCalled()
  })

  it('refuses withdrawal state changes when only the stub custody adapter is installed', async () => {
    const { service, ledger, security } = buildService({ execution: true })
    await expect(service.createWithdrawal(
      { userId: 'user-1', sessionId: 'session-1', deviceId: null },
      { network: 'arbitrum', atomicAmount: '10000000', destination: '0x1111111111111111111111111111111111111111', reauthentication: 'reauthentication-token' },
      'withdrawal-key-1',
      'request-1',
    )).rejects.toMatchObject({ response: expect.objectContaining({ code: 'WALLET_EXECUTION_DISABLED' }) })
    expect(security.assertRecentStepUp).not.toHaveBeenCalled()
    expect(ledger.createWithdrawalWithLock).not.toHaveBeenCalled()
  })

  it('refuses to start financial mode when the installed custody adapter is still a stub', () => {
    expect(() => buildService({ financial: true })).toThrow(/live CustodyAdapter/)
  })

  it('requires an aged trusted device and an active address-book entry in financial mode', async () => {
    const liveAdapter: CustodyAdapter = {
      name: 'test-live-custody', mode: 'live',
      provisionWallet: jest.fn(), provisionAddress: jest.fn(),
      screenAddress: jest.fn().mockResolvedValue({ decision: 'clear' }),
      broadcastWithdrawal: jest.fn(),
    }
    const {
      service, wallets, accounts, balances, withdrawals, withdrawalAddresses, devices, ledger,
    } = buildService({ execution: true, financial: true, adapter: liveAdapter })
    const destination = '0x1111111111111111111111111111111111111111'
    withdrawalAddresses.findOne.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001', userId: 'user-1', network: 'arbitrum', assetCode: 'USDT',
      state: 'active', riskState: 'clear', addressCiphertext: Buffer.from(destination),
    })
    devices.findOne.mockResolvedValue({
      id: 'device-1', userId: 'user-1', trustState: 'trusted', firstSeenAt: new Date(Date.now() - 90_000_000),
    })
    accounts.findOne.mockResolvedValue({ id: 'available-account' })
    balances.findOne.mockResolvedValue({ currentAtomicBalance: '20000000' })
    wallets.findOne.mockResolvedValue({ id: 'wallet-1', userId: 'user-1', state: 'active' })
    withdrawals.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'withdrawal-1', userId: 'user-1', network: 'arbitrum', atomicAmount: '10000000',
        feeAtomicAmount: '500000', state: 'risk_review', reasonCode: 'awaiting_admin_approvals',
      })
    ledger.createWithdrawalWithLock.mockResolvedValue({ id: 'withdrawal-1', created: true })

    const response = await service.createWithdrawal(
      { userId: 'user-1', sessionId: 'session-1', deviceId: 'device-1' },
      {
        network: 'arbitrum', atomicAmount: '10000000',
        addressBookId: '10000000-0000-4000-8000-000000000001', reauthentication: 'reauthentication-token',
      },
      'withdrawal-key-financial-1',
      'request-financial-1',
    )

    expect(response.state).toBe('risk_review')
    expect(ledger.createWithdrawalWithLock).toHaveBeenCalledWith(expect.objectContaining({
      addressBookEntryId: '10000000-0000-4000-8000-000000000001',
      state: 'risk_review',
      policySnapshot: expect.objectContaining({ financialMode: true, approvalsRequired: 2 }),
    }))
  })

  it('records distinct administrator approvals before changing financial withdrawal state', async () => {
    const liveAdapter: CustodyAdapter = {
      name: 'test-live-custody', mode: 'live',
      provisionWallet: jest.fn(), provisionAddress: jest.fn(), screenAddress: jest.fn(), broadcastWithdrawal: jest.fn(),
    }
    const { service, withdrawals, withdrawalApprovals, ledger } = buildService({ financial: true, adapter: liveAdapter })
    withdrawals.findOne.mockResolvedValue({ id: 'withdrawal-1', state: 'risk_review' })
    withdrawalApprovals.findOne.mockResolvedValue(null)
    ledger.recordWithdrawalApproval
      .mockResolvedValueOnce({ id: 'withdrawal-1', state: 'risk_review', approvalCount: 1, approvalsRequired: 2 })
      .mockResolvedValueOnce({ id: 'withdrawal-1', state: 'approved', approvalCount: 2, approvalsRequired: 2 })

    const first = await service.decideWithdrawal('withdrawal-1', 'admin-1', true, undefined, 'request-1')
    const second = await service.decideWithdrawal('withdrawal-1', 'admin-2', true, undefined, 'request-2')

    expect(first.state).toBe('risk_review')
    expect(second.state).toBe('approved')
    expect(ledger.recordWithdrawalApproval).toHaveBeenCalledTimes(2)
    expect(withdrawalApprovals.save).not.toHaveBeenCalled()
  })

  it('prevents an approving administrator from manually executing the same financial withdrawal', async () => {
    const liveAdapter: CustodyAdapter = {
      name: 'test-live-custody', mode: 'live',
      provisionWallet: jest.fn(), provisionAddress: jest.fn(), screenAddress: jest.fn(), broadcastWithdrawal: jest.fn(),
    }
    const { service, withdrawalApprovals, ledger } = buildService({ execution: true, financial: true, adapter: liveAdapter })
    withdrawalApprovals.findOne.mockResolvedValue({ decision: 'approved' })

    await expect(service.executeApprovedWithdrawal('withdrawal-1', 'admin-1', 'request-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'WALLET_WITHDRAWAL_EXECUTOR_CONFLICT' }),
    })
    expect(ledger.claimWithdrawalExecution).not.toHaveBeenCalled()
  })

  it('blocks manual financial execution while the runtime funds switch is paused', async () => {
    const liveAdapter: CustodyAdapter = {
      name: 'test-live-custody', mode: 'live',
      provisionWallet: jest.fn(), provisionAddress: jest.fn(), screenAddress: jest.fn(), broadcastWithdrawal: jest.fn(),
    }
    const { service, fundsSwitch, ledger } = buildService({ execution: true, financial: true, adapter: liveAdapter })
    fundsSwitch.isWithdrawalExecutionEnabled.mockResolvedValue(false)

    await expect(service.executeApprovedWithdrawal('withdrawal-1', 'admin-3', 'request-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'WALLET_EXECUTION_DISABLED' }),
    })
    expect(ledger.claimWithdrawalExecution).not.toHaveBeenCalled()
  })

  it('acknowledges a retried queued execution after the withdrawal is already broadcast', async () => {
    const liveAdapter: CustodyAdapter = {
      name: 'test-live-custody', mode: 'live',
      provisionWallet: jest.fn(), provisionAddress: jest.fn(), screenAddress: jest.fn(), broadcastWithdrawal: jest.fn(),
    }
    const { service, withdrawals, ledger } = buildService({ execution: true, financial: true, adapter: liveAdapter })
    withdrawals.findOne.mockResolvedValue({
      id: 'withdrawal-1', state: 'broadcast', network: 'arbitrum', atomicAmount: '1000', feeAtomicAmount: '10',
    })

    await expect(service.executeQueuedWithdrawal('withdrawal-1', 'worker-1', 'request-1')).resolves.toMatchObject({
      id: 'withdrawal-1', state: 'broadcast',
    })
    expect(liveAdapter.broadcastWithdrawal).not.toHaveBeenCalled()
    expect(ledger.claimWithdrawalExecution).not.toHaveBeenCalled()
  })

  it('moves a confirmed signed callback through the idempotent ledger bridge in live mode', async () => {
    const liveAdapter: CustodyAdapter = {
      name: 'test-live-custody', mode: 'live',
      provisionWallet: jest.fn(), provisionAddress: jest.fn(), screenAddress: jest.fn(), broadcastWithdrawal: jest.fn(),
    }
    const { service, addresses, chains, deposits, ledger, secret } = buildService({ execution: true, adapter: liveAdapter })
    addresses.findOne.mockResolvedValue({ id: 'address-1', userId: 'user-1' })
    chains.save.mockImplementation(async (value: object) => ({ ...value }))
    deposits.save.mockImplementation(async (value: object) => ({ ...value }))
    deposits.findOneOrFail.mockResolvedValue({
      id: 'deposit-1', userId: 'user-1', state: 'credited', reasonCode: null, requiredConfirmations: 60,
    })
    const payload = {
      network: 'arbitrum' as const,
      transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      destinationAddress: '0x2222222222222222222222222222222222222222',
      atomicAmount: '1000000',
      confirmations: 60,
      outputIndex: 0,
      riskDecision: 'clear' as const,
    }
    const timestamp = String(Math.floor(Date.now() / 1000))
    const eventId = 'custody-event-1'
    const signature = createHmac('sha256', secret).update(`${timestamp}.${eventId}.${canonicalJson(payload)}`).digest('hex')

    const response = await service.processDepositCallback(eventId, timestamp, signature, payload)

    expect(ledger.creditDeposit).toHaveBeenCalledWith(expect.any(String), 'user-1', 'arbitrum', '1000000', eventId)
    expect(response.deposit.state).toBe('credited')
    expect(response.retryPolicy.duplicateEventsAreIdempotent).toBe(true)
  })

  it('credits a confirmed signed callback in explicit local Demo mode without enabling real execution', async () => {
    const { service, addresses, chains, deposits, ledger, secret } = buildService({ demoCredit: true })
    addresses.findOne.mockResolvedValue({ id: 'address-1', userId: 'user-1' })
    chains.save.mockImplementation(async (value: object) => ({ ...value }))
    deposits.save.mockImplementation(async (value: object) => ({ ...value }))
    deposits.findOneOrFail.mockResolvedValue({
      id: 'deposit-1', userId: 'user-1', state: 'credited', reasonCode: null, requiredConfirmations: 60,
    })
    const payload = {
      network: 'arbitrum' as const,
      transactionHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      destinationAddress: '0x4444444444444444444444444444444444444444',
      atomicAmount: '1000000',
      confirmations: 60,
      outputIndex: 0,
      riskDecision: 'clear' as const,
    }
    const timestamp = String(Math.floor(Date.now() / 1000))
    const eventId = 'demo-custody-event-1'
    const signature = createHmac('sha256', secret).update(`${timestamp}.${eventId}.${canonicalJson(payload)}`).digest('hex')

    const response = await service.processDepositCallback(eventId, timestamp, signature, payload)

    expect(ledger.creditDeposit).toHaveBeenCalledWith(expect.any(String), 'user-1', 'arbitrum', '1000000', eventId)
    expect(response.integration).toMatchObject({ adapterMode: 'stub', demoCreditEnabled: true, realFunds: false })
  })
})

describe('StubCustodyAdapter', () => {
  it('never broadcasts a real withdrawal', async () => {
    const adapter = new StubCustodyAdapter()
    await expect(adapter.broadcastWithdrawal({
      withdrawalId: 'withdrawal-1', network: 'tron', assetCode: 'USDT', atomicAmount: '1000000', destination: 'TAddress',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'WALLET_EXECUTION_DISABLED' }) })
  })
})
