import { ApiRateLimiter } from '../../src/common/api-rate-limit.middleware'
import { AiChatRateLimitGuard } from '../../src/ai/ai-rate-limit.guard'

describe('AI per-session rate limits', () => {
  it('allows 30 signed-in messages per ten minutes across IPs, separately per user', () => {
    const limiter = new ApiRateLimiter()
    for (let i=0;i<30;i++) expect(limiter.consumeAi('one',String(i),0).allowed).toBe(true)
    expect(limiter.consumeAi('one','another-ip',1)).toMatchObject({ allowed: false, retryAfterSeconds: 600 })
    expect(limiter.consumeAi('two','same-ip',1).allowed).toBe(true)
    expect(limiter.consumeAi('one','another-ip',600000).allowed).toBe(true)
  })
  it('allows ten guest messages per IP and never trusts a body userId', () => {
    const guard = new AiChatRateLimitGuard(), response = { locals: {}, setHeader: jest.fn() }
    const request = { ip: '127.0.0.1', socket: {}, body: { userId: 'pretend-user' } }
    const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) }
    for(let i=0;i<10;i++) expect(guard.canActivate(context as any)).toBe(true)
    expect(() => guard.canActivate(context as any)).toThrow()
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String))
  })
})
