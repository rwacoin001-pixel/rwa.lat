import { Module } from '@nestjs/common'
import { ReferralBindingService } from './referral-binding.service'
import { ReferralContext } from './referral-context'
import { ReferralFoundationService } from './referral-foundation.service'
import { ReferralReadService } from './referral-read.service'
import { ReferralClaimService } from './referral-claim.service'

@Module({ providers:[ReferralContext,ReferralBindingService,ReferralFoundationService,ReferralReadService,ReferralClaimService],
  exports:[ReferralContext,ReferralBindingService,ReferralFoundationService,ReferralReadService,ReferralClaimService] })
export class ReferralModule {}
