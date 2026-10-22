import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { REFERRAL_DEFAULT_SETTINGS,validateReferralSettings,assertAwardTransition } from '../../src/referral/referral-policy'
import { ReferralFoundationService } from '../../src/referral/referral-foundation.service'
import { ReferralContext } from '../../src/referral/referral-context'
import { ReferralClaimService } from '../../src/referral/referral-claim.service'
import { ReferralAdminFoundationController,ReferralUserFoundationController } from '../../src/referral/referral-http.module'
import { DataSource } from 'typeorm'

describe('referral immutable policy',()=>{
  it('accepts configured rates without a 50 percent budget clamp',()=>{
    expect(()=>validateReferralSettings({...REFERRAL_DEFAULT_SETTINGS,feeRatesBps:[4000,3000,2000]})).not.toThrow()
  })
  it.each([
    {teamDepth:4},{claimExclusive:false},{idempotencyRequired:false},{budgetEnforcementEnabled:true},
    {payoutsEnabled:true},{existingAccountBinding:true},{autoApprove:true},{feeRatesBps:[20.1,10,5]},
    {dailyRiskAtomic:'0.1'},{feeComponents:['unknown']},
  ])('rejects disabling immutable safeguards or unsafe parameter %j',patch=>{
    expect(()=>validateReferralSettings({...REFERRAL_DEFAULT_SETTINGS,...patch})).toThrow(BadRequestException)
  })
  it('requires continuous exact atomic team tiers',()=>{
    expect(()=>validateReferralSettings({...REFERRAL_DEFAULT_SETTINGS,teamTiers:[{fromAtomic:'1',toAtomic:null,rateBps:100}]})).toThrow()
  })
  it('never permits a claimed award to become claimable again',()=>{
    expect(()=>assertAwardTransition('claimed_credit','available')).toThrow()
    expect(()=>assertAwardTransition('claimed_cash','frozen')).toThrow()
    expect(()=>assertAwardTransition('candidate','available')).toThrow()
    expect(()=>assertAwardTransition('available','frozen')).not.toThrow()
    expect(()=>assertAwardTransition('frozen','available')).not.toThrow()
  })
  it('keeps stage-zero award payouts disabled; claims go through the reward claim service with an idempotency key',async()=>{
    const service=new ReferralFoundationService({} as DataSource)
    expect(()=>service.assertPayoutsDisabled()).toThrow(ServiceUnavailableException)
    const claims=new ReferralClaimService({} as DataSource)
    const controller=new ReferralUserFoundationController({} as never,{} as never,claims,{} as never)
    await expect(controller.claim({auth:{userId:'u'}} as never,undefined)).rejects.toThrow(BadRequestException)
  })
  it('rejects unauthorized settings writes before accessing the database',async()=>{
    const core={saveSettings:jest.fn()},rbac={assertPermission:jest.fn().mockRejectedValue(new Error('denied'))}
    const controller=new ReferralAdminFoundationController(core as never,rbac as never,{} as never,{} as never)
    await expect(controller.save({id:'unauthorized'} as never,{config:{payoutsEnabled:true}})).rejects.toThrow('denied')
    expect(core.saveSettings).not.toHaveBeenCalled()
  })
  it('keeps concurrent registration attribution contexts separate',async()=>{
    const context=new ReferralContext()
    const values=await Promise.all(['first','second'].map(token=>context.run(token,async()=>{
      await new Promise(resolve=>setTimeout(resolve,5));return context.token()
    })))
    expect(values).toEqual(['first','second']);expect(context.token()).toBeUndefined()
  })
})
