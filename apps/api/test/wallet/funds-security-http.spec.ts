import 'reflect-metadata'
import { GUARDS_METADATA, HEADERS_METADATA } from '@nestjs/common/constants'
import { ApiRateLimiter } from '../../src/common/api-rate-limit.middleware'
import { TransactionPinController } from '../../src/wallet/transaction-pin.controller'
import { SessionAuthGuard } from '../../src/security/session-auth.guard'
import { VerifiedEmailGuard } from '../../src/security/verified-email.guard'
import { HttpExceptionFilter } from '../../src/common/http-exception.filter'
import { ConflictException } from '@nestjs/common'

describe('funds security HTTP boundaries', () => {
  it('requires session authentication and verified email for every credential mutation', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA,TransactionPinController)).toContain(SessionAuthGuard)
    for (const action of ['setup','change','reset'] as const) {
      expect(Reflect.getMetadata(GUARDS_METADATA,TransactionPinController.prototype[action])).toContain(VerifiedEmailGuard)
      expect(Reflect.getMetadata(HEADERS_METADATA,TransactionPinController.prototype[action])).toContainEqual({name:'Cache-Control',value:'no-store'})
    }
  })
  it('caps PIN-bearing endpoints without limiting read-only quotes in the same bucket', () => {
    const limiter = new ApiRateLimiter()
    for(let i=0;i<10;i++)expect(limiter.consume({method:'POST',path:'/v1/wallet/withdrawals',ip:'127.0.0.19',now:0}).allowed).toBe(true)
    expect(limiter.consume({method:'POST',path:'/v1/security/transaction-password/change',ip:'127.0.0.19',now:0}).allowed).toBe(false)
    expect(limiter.consume({method:'POST',path:'/v1/wallet/withdrawals/quote',ip:'127.0.0.19',now:0}).allowed).toBe(true)
  })
  it('returns only explicit safe error remediation, with no PIN/hash and no cache', () => {
    const response={setHeader:jest.fn(),status:jest.fn(),json:jest.fn(),locals:{requestId:'req'}};response.status.mockReturnValue(response)
    const host={switchToHttp:()=>({getRequest:()=>({method:'POST',path:'/v1/security/transaction-password/change',url:'/v1/security/transaction-password/change'}),getResponse:()=>response})}
    new HttpExceptionFilter().catch(new ConflictException({code:'TRANSACTION_PIN_INVALID',message:'Wrong PIN',remainingAttempts:4,serverTime:'2026-10-09T00:00:00Z',pin:'secret',pinHash:'hash'}),host as never)
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control','no-store')
    expect(response.json.mock.calls[0][0].error.details).toEqual({remainingAttempts:4,serverTime:'2026-10-09T00:00:00Z'})
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('secret')
  })
})
