import { Module } from '@nestjs/common'
import { ReferralBindingService } from './referral-binding.service'
import { ReferralContext } from './referral-context'
import { ReferralFoundationService } from './referral-foundation.service'
import { ReferralReadService } from './referral-read.service'

@Module({ providers:[ReferralContext,ReferralBindingService,ReferralFoundationService,ReferralReadService],
  exports:[ReferralContext,ReferralBindingService,ReferralFoundationService,ReferralReadService] })
export class ReferralModule {}
