import 'reflect-metadata'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { SessionAuthGuard } from '../../src/security/session-auth.guard'
import { RewardsController } from '../../src/rewards/rewards.controller'
import { RewardsLiveGuard } from '../../src/rewards/rewards-live.guard'
import { HttpExceptionFilter } from '../../src/common/http-exception.filter'
import { rewardConflict } from '../../src/rewards/rewards.errors'

describe('rewards HTTP contract', () => {
  it('routes odds through the same authenticated/live-gated controller', async () => {
    const odds=jest.fn().mockResolvedValue({ version:2,points:[],vouchers:[] })
    const controller=new RewardsController({ odds } as never)
    expect(await controller.odds({ userId:'user' } as never)).toEqual({ version:2,points:[],vouchers:[] })
    expect(odds).toHaveBeenCalledWith('user')
  })
  it('authenticates every route before checking rollout visibility', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, RewardsController)).toEqual([SessionAuthGuard, RewardsLiveGuard])
    const response = { setHeader: jest.fn() }
    const context = { switchToHttp: () => ({ getRequest: () => ({ header: () => undefined }), getResponse: () => response }) }
    const authenticate = jest.fn()
    await expect(new SessionAuthGuard({ authenticate } as never).canActivate(context as never)).rejects.toMatchObject({ status: 401 })
    expect(authenticate).not.toHaveBeenCalled()
  })
  it('uses only the signed edge client IP (normalised), never req.ip or forwarding headers', async () => {
    const draw = jest.fn(), controller = new RewardsController({ draw } as never)
    controller.draw({ userId: 'user' } as never, 'key', { locals: { edgeClient: { ip: '::ffff:192.0.2.1', country: null } } } as never)
    expect(draw).toHaveBeenLastCalledWith('user', 'key', '192.0.2.1')
    controller.draw({ userId: 'user' } as never, 'key', { locals: {} } as never)
    expect(draw).toHaveBeenLastCalledWith('user', 'key', null)
  })
  it('preserves only the public eligibility reason in the standard app error envelope', () => {
    const response = { status: jest.fn(), json: jest.fn(), locals: { requestId: 'test' } }; response.status.mockReturnValue(response)
    const host = { switchToHttp: () => ({ getRequest: () => ({ method: 'POST', path: '/v1/rewards/draw', url: '/v1/rewards/draw' }), getResponse: () => response }) }
    new HttpExceptionFilter().catch(rewardConflict('REWARD_NOT_ELIGIBLE', 'no_card_today'), host as never)
    expect(response.status).toHaveBeenCalledWith(409)
    expect(response.json.mock.calls[0][0].error).toMatchObject({ code: 'REWARD_NOT_ELIGIBLE', details: { reason: 'no_card_today' } })
  })
})
