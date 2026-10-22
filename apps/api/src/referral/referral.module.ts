import { Module } from '@nestjs/common'
import { ReferralBindingService } from './referral-binding.service'
import { ReferralContext } from './referral-context'
import { ReferralFoundationService } from './referral-foundation.service'
import { ReferralReadService } from './referral-read.service'
import { ReferralClaimService } from './referral-claim.service'
import { ReferralTeamService } from './referral-team.service'
import { ReferralTeamRunner } from './referral-team.runner'

@Module({ providers:[ReferralContext,ReferralBindingService,ReferralFoundationService,ReferralReadService,ReferralClaimService,ReferralTeamService,ReferralTeamRunner],
  exports:[ReferralContext,ReferralBindingService,ReferralFoundationService,ReferralReadService,ReferralClaimService,ReferralTeamService] })
export class ReferralModule {}
