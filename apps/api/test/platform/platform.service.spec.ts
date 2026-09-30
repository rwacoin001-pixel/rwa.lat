import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { PlatformService } from '../../src/platform/platform.service'
import { ObjectStorageService } from '../../src/object-storage/object-storage.service'

describe('Published platform information and access', () => {
  const content = { legalName: 'Test operator', allowedRegions: ['SG'], investorTypes: ['professional'], documents: [{ title: 'Internal', storageRef: 'rwa-assets/internal.pdf', public: false }, { title: 'Terms', storageRef: 'rwa-assets/terms.pdf', public: true }] }
  function setup() {
    const db = { query: jest.fn() }
    const storage = { createPublishedAssetUrl: jest.fn().mockResolvedValue('https://storage.example/signed') }
    const service = new PlatformService(db as unknown as DataSource, storage as unknown as ObjectStorageService, new ConfigService({ APP_ENV: 'production', PUBLIC_API_URL: '' }))
    return { db, storage, service }
  }
  it('exposes only published public documents, never private storage references', async () => {
    const { db, service } = setup()
    db.query.mockResolvedValue([{ published: content, revision: 2 }])
    const result = await service.publicProfile()
    expect(result.documents).toEqual([{ title: 'Terms', kind: 'general', reportDate: null, asOfDate: null, issuer: null, url: '/v1/platform/documents/2/1' }])
    expect(JSON.stringify(result)).not.toContain('internal.pdf')
    expect(JSON.stringify(result)).not.toContain('storageRef')
  })
  it('rejects private documents and old published revisions before signing', async () => {
    const { db, storage, service } = setup()
    db.query.mockResolvedValue([{ published: content, revision: 2 }])
    await expect(service.publicDocument(2, 0)).rejects.toThrow()
    await expect(service.publicDocument(1, 1)).rejects.toThrow()
    expect(storage.createPublishedAssetUrl).not.toHaveBeenCalled()
  })
  it('does not authorize a production investment without published rules', async () => {
    const { db, service } = setup()
    db.query.mockResolvedValue([{ published: null, revision: null }])
    expect((await service.evaluateAccess('u')).allowed).toBe(false)
  })
  it('requires both verified country and investor type to match', async () => {
    const { db, service } = setup()
    db.query.mockResolvedValueOnce([{ published: content, revision: 2 }]).mockResolvedValueOnce([{ region: 'SG', investor_type: 'retail' }])
    expect((await service.evaluateAccess('u')).allowed).toBe(false)
    db.query.mockResolvedValueOnce([{ published: content, revision: 2 }]).mockResolvedValueOnce([{ region: 'SG', investor_type: 'professional' }])
    expect((await service.evaluateAccess('u')).allowed).toBe(true)
  })
  it('a missing published product cannot generate a cover download', async () => {
    const { db, storage, service } = setup()
    db.query.mockResolvedValue([])
    await expect(service.productCover('id')).rejects.toThrow()
    expect(storage.createPublishedAssetUrl).not.toHaveBeenCalled()
  })
})
