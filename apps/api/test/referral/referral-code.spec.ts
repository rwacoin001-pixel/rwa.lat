import { generateShortCode, isLegacyGeneratedCode, normalizeReferralCode, SHORT_CODE_ALPHABET } from '../../src/referral/referral-code'
import { ReferralBindingService } from '../../src/referral/referral-binding.service'
import { ReferralPublicController } from '../../src/referral/referral-http.module'

describe('referral short codes',()=>{
  it('generates 6 characters without ambiguous 0/O/1/I/L',()=>{
    for (let i=0;i<500;i++) {
      const code=generateShortCode()
      expect(code).toMatch(/^[a-z0-9]{6}$/)
      expect(code).not.toMatch(/[01ilo]/)
    }
    expect(SHORT_CODE_ALPHABET).toHaveLength(31)
  })
  it('never generates a reserved word',()=>{
    const word='system',draws=[...word,...'k7m4qx'].map(ch=>SHORT_CODE_ALPHABET.indexOf(ch))
    expect(generateShortCode(()=>draws.shift()!)).toBe('k7m4qx')
  })
  it('accepts typed codes in any case with spaces or dashes, and every legacy shape',()=>{
    expect(normalizeReferralCode(' K7M-4QX ')).toBe('k7m4qx')
    expect(normalizeReferralCode('A3F9C27E51D08B4F')).toBe('a3f9c27e51d08b4f')
    expect(normalizeReferralCode('areit2026')).toBe('areit2026')
    expect(normalizeReferralCode('k7m4')).toBeNull()
    expect(normalizeReferralCode('system')).toBeNull()
    expect(normalizeReferralCode('k7m4q!')).toBeNull()
    expect(normalizeReferralCode(42)).toBeNull()
  })
  it('recognises only system-generated legacy codes',()=>{
    expect(isLegacyGeneratedCode('a3f9c27e51d08b4f')).toBe(true)
    expect(isLegacyGeneratedCode('k7m4qx')).toBe(false)
    expect(isLegacyGeneratedCode('areit2026')).toBe(false)
  })
})

describe('referral public lookup',()=>{
  const service=(rows:unknown[])=>{
    const db:{query:jest.Mock;manager?:unknown}={query:jest.fn(async(sql:string)=>sql.includes('to_regclass')?[{installed:true}]:rows)}; db.manager=db
    return {db,binding:new ReferralBindingService(db as never,{} as never,{token:()=>undefined} as never)}
  }
  it('reports an active code in display case without touching the database for malformed input',async()=>{
    const {db,binding}=service([{code:'k7m4qx'}])
    await expect(binding.lookup('k7m-4qx')).resolves.toEqual({valid:true,code:'K7M4QX'})
    expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('referral_code_aliases'),['k7m4qx'])
    db.query.mockClear()
    await expect(binding.lookup('no')).resolves.toEqual({valid:false})
    expect(db.query).toHaveBeenCalledTimes(1)
  })
  it('reports unknown or inactive codes as invalid without naming the inviter',async()=>{
    const {binding}=service([])
    const result=await binding.lookup('k7m4qx')
    expect(result).toEqual({valid:false})
  })
  it('the public controller returns the attribution code, never a token',async()=>{
    const binding={describeAttribution:jest.fn().mockResolvedValue({code:'K7M4QX',expiresAt:new Date(0)}),currentAttribution:()=>'signed.token'}
    const controller=new ReferralPublicController(binding as never)
    const body=await controller.attribution()
    expect(binding.describeAttribution).toHaveBeenCalledWith('signed.token')
    expect(JSON.stringify(body)).not.toContain('signed.token')
    expect(body.attribution?.code).toBe('K7M4QX')
  })
})
