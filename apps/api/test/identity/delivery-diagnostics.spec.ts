import { ConfigService } from '@nestjs/config'
import { Logger } from '@nestjs/common'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'

jest.mock('../../src/common/email-delivery.client', () => ({EmailDeliveryClient: jest.fn(() => ({configured:true,send:jest.fn().mockRejectedValue(new Error('secret-address@example.com code 012345 api-key')),close:jest.fn()}))}))

test('delivery failures log only a safe classification and retain the generic public error', async () => {
  const warning=jest.spyOn(Logger.prototype,'warn').mockImplementation(()=>{})
  const service=new IdentityDeliveryService(new ConfigService({AUTH_ADAPTER:'production'}))
  await expect(service.sendEmailCode({email:'secret-address@example.com',intent:'login',code:'012345',locale:'en'})).rejects.toMatchObject({response:{code:'AUTH_DELIVERY_FAILED'}})
  expect(warning).toHaveBeenCalledWith(expect.objectContaining({event:'identity_email_delivery_failed',stage:'code',cause:'Error'}))
  expect(JSON.stringify(warning.mock.calls)).not.toMatch(/secret-address|012345|api-key/)
  warning.mockRestore()
})
