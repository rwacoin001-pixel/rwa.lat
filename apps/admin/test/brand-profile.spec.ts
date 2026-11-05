import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { SavePlatformDto } from '../src/admin-platform.dto'
import { AdminPlatformService } from '../src/admin-platform.service'
import { ConfigService } from '@nestjs/config'

const profile = { brandId: 'kimeng', status: 'draft', legalName: '', registrationNumber: '', jurisdiction: '', address: '', supportEmail: '', description: '' }
const content = { legalName: 'Existing operator', registrationNumber: 'EXAMPLE', jurisdiction: 'SG', address: 'Existing address', supportEmail: 'support@example.test', description: '', allowedRegions: ['SG'], investorTypes: ['retail'], documents: [] }

it('accepts incomplete Kimeng drafts but rejects unknown brands and injected configuration', async () => {
  const dto = (value: unknown) => plainToInstance(SavePlatformDto, { expectedRevision: 1, content: { ...content, brandProfiles: [value] } })
  expect(await validate(dto(profile), { whitelist: true, forbidNonWhitelisted: true })).toEqual([])
  for (const bad of [{ ...profile, brandId: 'attacker' }, { ...profile, apiUrl: 'https://evil.test' }, { ...profile, supportEmail: 'not-an-email' }]) {
    expect((await validate(dto(bad), { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0)
  }
})

it('refuses publication of an incomplete ready profile before inserting a version', async () => {
  const row = { revision: 3, draft: { ...content, brandProfiles: [{ ...profile, status: 'ready' }] }, published_revision: 2 }
  const query = jest.fn(async (sql: string) => ({ rows: sql.startsWith('SELECT') ? [row] : [] }))
  const service = new AdminPlatformService(new ConfigService())
  Object.assign(service, { pool: { query, connect: async () => ({ query, release: jest.fn() }) } })
  await expect(service.publishPlatformConfiguration({ expectedRevision: 3 }, 'admin')).rejects.toThrow(/金英/)
  expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.platform_configuration_versions'))).toBe(false)
  expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
})
