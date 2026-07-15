import { createHmac } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { LedgerCallbackController } from '../../src/ledger/ledger.controller'
import { CustodyWebhookVerifier, canonicalJson } from '../../src/wallet/custody-webhook.verifier'

describe('LedgerCallbackController', () => {
  const secret = 'custody-reconciliation-callback-secret'
  const payload = {
    network: 'arbitrum' as const,
    observedAtomicBalance: '1000000',
    periodStart: '2026-07-14T00:00:00.000Z',
    periodEnd: '2026-07-15T00:00:00.000Z',
    sourceReference: 'custody-statement-2026-07-14',
  }

  it('accepts a signed snapshot and sends it to the non-mutating reconciliation service', async () => {
    const ledger = { reconcileCustody: jest.fn().mockResolvedValue({ state: 'matched' }) }
    const config = { get: (key: string) => key === 'WALLET_CUSTODY_ADAPTER' ? 'live-custody' : secret }
    const controller = new LedgerCallbackController(
      ledger as never,
      new CustodyWebhookVerifier(config as unknown as ConfigService),
      config as unknown as ConfigService,
    )
    const eventId = 'reconciliation-event-1'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${eventId}.${canonicalJson(payload)}`)
      .digest('hex')

    await expect(controller.reconcile(eventId, timestamp, signature, payload)).resolves.toMatchObject({ state: 'matched' })
    expect(ledger.reconcileCustody).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'live-custody',
      sourceReference: 'custody-statement-2026-07-14',
      partnerEventId: eventId,
      requestId: eventId,
    }))
  })

  it('rejects an unsigned snapshot before any reconciliation work', () => {
    const ledger = { reconcileCustody: jest.fn() }
    const config = { get: (key: string) => key === 'WALLET_CUSTODY_ADAPTER' ? 'live-custody' : secret }
    const controller = new LedgerCallbackController(
      ledger as never,
      new CustodyWebhookVerifier(config as unknown as ConfigService),
      config as unknown as ConfigService,
    )

    expect(() => controller.reconcile('event-2', String(Math.floor(Date.now() / 1000)), 'bad-signature', payload)).toThrow()
    expect(ledger.reconcileCustody).not.toHaveBeenCalled()
  })
})
