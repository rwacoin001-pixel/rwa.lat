import { generateShortCode, isLegacyGeneratedCode, normalizeReferralCode, SHORT_CODE_ALPHABET, RESERVED_REFERRAL_CODES } from '../../src/referral/referral-code'
import { ReferralBindingService } from '../../src/referral/referral-binding.service'
import { ReferralPublicController } from '../../src/referral/referral-http.module'
import { validate } from 'class-validator'
import { CodeDto } from '../../src/referral/referral-http.module'

describe('custom referral code rule',()=>{
  function binding() {
    const query=jest.fn(async(sql:string)=>sql.includes('to_regclass')?[{installed:true}]:sql.includes('SELECT status')?[{status:'active'}]:[])
    const db={query,manager:{query},transaction:async(run:any)=>run({query})}
    return {service:new ReferralBindingService(db as never,{} as never,{} as never),query}
  }
  it.each(['AREIT0','123456','aReIt9'])('stores %s in lowercase',async code=>{
    const {service,query}=binding()
    await expect(service.changeCode('viewer',code)).resolves.toBe(code.toLowerCase())
    expect(query).toHaveBeenCalledWith('INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)',[code.toLowerCase(),'viewer'])
    expect(await validate(Object.assign(new CodeDto(),{code}))).toHaveLength(0)
  })
  it('keeps the reserved-code check even for a code matching the new alphabet',async()=>{
    RESERVED_REFERRAL_CODES.add('areit0')
    try { await expect(binding().service.changeCode('viewer','AREIT0')).rejects.toThrow('Referral code must be exactly 6 characters') }
    finally { RESERVED_REFERRAL_CODES.delete('areit0') }
  })
  it.each(['areit','areit12','abcdef','areit!','ARE-10',' are10','system'])('rejects %s at both boundaries',async code=>{
    await expect(binding().service.changeCode('viewer',code)).rejects.toThrow('Referral code must be exactly 6 characters using A, R, E, I, T and 0–9')
    expect((await validate(Object.assign(new CodeDto(),{code}))).length).toBeGreaterThan(0)
  })
})

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
  it('keeps existing longer codes resolvable without rewriting them',async()=>{
    const {db,binding}=service([{code:'areit2026'}])
    await expect(binding.lookup('AREIT2026')).resolves.toEqual({valid:true,code:'AREIT2026'})
    expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('referral_code_aliases'),['areit2026'])
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
