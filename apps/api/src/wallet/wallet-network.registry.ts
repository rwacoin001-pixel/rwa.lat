import { BadRequestException, Injectable } from '@nestjs/common'
import type { WalletNetwork } from './wallet.entities'
import { WALLET_ERROR_CODES } from './wallet.errors'

export interface WalletNetworkConfig {
  id: WalletNetwork
  displayName: string
  assetCode: 'USDT'
  assetDecimals: 6
  requiredConfirmations: number
  minimumDepositAtomic: string
  minimumWithdrawalAtomic: string
  withdrawalFeeAtomic: string
  estimatedArrivalMinutes: [number, number]
  warning: string
  configurationSource: 'demo-policy'
}

const NETWORKS: Readonly<Record<WalletNetwork, WalletNetworkConfig>> = Object.freeze({
  tron: {
    id: 'tron', displayName: 'TRON', assetCode: 'USDT', assetDecimals: 6,
    requiredConfirmations: 20, minimumDepositAtomic: '1000000', minimumWithdrawalAtomic: '10000000',
    withdrawalFeeAtomic: '1000000', estimatedArrivalMinutes: [2, 10],
    warning: 'Send TRC-20 USDT only. Other assets or networks require manual recovery review.',
    configurationSource: 'demo-policy',
  },
  ethereum: {
    id: 'ethereum', displayName: 'Ethereum', assetCode: 'USDT', assetDecimals: 6,
    requiredConfirmations: 64, minimumDepositAtomic: '10000000', minimumWithdrawalAtomic: '50000000',
    withdrawalFeeAtomic: '12000000', estimatedArrivalMinutes: [12, 30],
    warning: 'Send ERC-20 USDT only. Network fees can change before approval.',
    configurationSource: 'demo-policy',
  },
  arbitrum: {
    id: 'arbitrum', displayName: 'Arbitrum One', assetCode: 'USDT', assetDecimals: 6,
    requiredConfirmations: 60, minimumDepositAtomic: '1000000', minimumWithdrawalAtomic: '10000000',
    withdrawalFeeAtomic: '500000', estimatedArrivalMinutes: [2, 10],
    warning: 'Send native Arbitrum USDT only. Bridged variants are not automatically credited.',
    configurationSource: 'demo-policy',
  },
})

@Injectable()
export class WalletNetworkRegistry {
  list(): WalletNetworkConfig[] {
    return Object.values(NETWORKS)
  }

  get(network: string): WalletNetworkConfig {
    if (!(network in NETWORKS)) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.NETWORK_UNSUPPORTED, message: 'Unsupported wallet network.' })
    }
    return NETWORKS[network as WalletNetwork]
  }
}
