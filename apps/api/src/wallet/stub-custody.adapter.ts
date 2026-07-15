import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import type {
  AddressScreeningResult,
  BroadcastWithdrawalRequest,
  BroadcastWithdrawalResult,
  CustodyAdapter,
  ProvisionedAddress,
  ProvisionedWallet,
} from './custody-adapter.interface'
import type { WalletNetwork } from './wallet.entities'
import { WALLET_ERROR_CODES } from './wallet.errors'

@Injectable()
export class StubCustodyAdapter implements CustodyAdapter {
  readonly name = 'stub-custody'
  readonly mode = 'stub' as const

  async provisionWallet(userId: string): Promise<ProvisionedWallet> {
    return { providerReference: `stub-wallet:${userId}` }
  }

  async provisionAddress(providerWalletReference: string, network: WalletNetwork): Promise<ProvisionedAddress> {
    const digest = createHash('sha256').update(`${providerWalletReference}:${network}:USDT`).digest('hex')
    if (network === 'tron') {
      const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      const body = [...Buffer.from(digest, 'hex').subarray(0, 20)].map((byte) => alphabet[byte % alphabet.length]).join('')
      return { address: `T${body.padEnd(33, '1').slice(0, 33)}`, memo: null }
    }
    return { address: `0x${digest.slice(0, 40)}`, memo: null }
  }

  async screenAddress(): Promise<AddressScreeningResult> {
    return { decision: 'manual_review', reasonCode: 'custody_partner_not_configured' }
  }

  async broadcastWithdrawal(_request: BroadcastWithdrawalRequest): Promise<BroadcastWithdrawalResult> {
    throw new ServiceUnavailableException({
      code: WALLET_ERROR_CODES.EXECUTION_DISABLED,
      message: 'The stub custody adapter cannot broadcast real withdrawals.',
    })
  }
}
