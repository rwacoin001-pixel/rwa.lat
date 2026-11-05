import { ConfigService } from '@nestjs/config'
import { PlatformService } from '../../src/platform/platform.service'

it('keeps unready brand profiles out of public platform responses and rejects them by brand', async () => {
  const db = { query: jest.fn().mockResolvedValue([{ published: { legalName: 'Existing', documents: [], brandProfiles: [{ brandId: 'kimeng', status: 'draft', legalName: 'Unconfirmed' }] }, revision: 2 }]) }
  const service = new PlatformService(db as never, {} as never, new ConfigService())
  expect(JSON.stringify(await service.publicProfile())).not.toContain('Unconfirmed')
  await expect(service.publicBrandProfile('kimeng')).rejects.toThrow()
  await expect(service.publicBrandProfile('arbitrary')).rejects.toThrow()
})

it('returns only the published ready Kimeng profile and the fixed shared-account notice', async () => {
  const profile = { brandId: 'kimeng', status: 'ready', legalName: 'Verified operator', registrationNumber: '123', jurisdiction: 'SG', address: 'Address', supportEmail: 'support@example.test', description: 'Published copy' }
  const db = { query: jest.fn().mockResolvedValue([{ published: { documents: [], brandProfiles: [profile] }, revision: 4, publishedAt: '2026-11-05' }]) }
  const service = new PlatformService(db as never, {} as never, new ConfigService())
  expect(await service.publicBrandProfile('kimeng')).toMatchObject({ brandId: 'kimeng', legalName: 'Verified operator', revision: 4, sharedAccounts: true, origin: 'https://kimengresearch.com' })
})
