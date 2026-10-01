import { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import { AdminStorageService } from '../src/admin-storage.service'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async () => 'https://storage.example.invalid/signed-test') }))

describe('Administrator file scan requirements', () => {
  function fixture(requireScan?: string, state = 'pending', size = '12') {
    const service = new AdminStorageService({} as DataSource, new ConfigService({
      OBJECT_STORAGE_ENABLED: 'true', OBJECT_STORAGE_REQUIRE_SCAN: requireScan,
      S3_REGION: 'test-region', S3_ACCESS_KEY: 'test-only', S3_SECRET_KEY: 'test-only',
    }))
    jest.spyOn(service as any, 'getObjectRow').mockResolvedValue({ id: 'object', bucket: 'rwa-assets', key: 'test.pdf', size_bytes: size, scan_status: state })
    jest.spyOn(service as any, 'query').mockResolvedValue([])
    return service
  }
  beforeEach(() => jest.clearAllMocks())
  it('defaults to requiring a clean scan', async () => {
    const service = fixture()
    expect(service.status().requireScan).toBe(true)
    await expect(service.createDownload('object', 'admin')).rejects.toThrow('安全校验')
    expect(getSignedUrl).not.toHaveBeenCalled()
  })
  it('temporarily allows pending reads only when explicitly configured', async () => {
    const service = fixture('false')
    expect(service.status().requireScan).toBe(false)
    await expect(service.createDownload('object', 'admin')).resolves.toMatchObject({ objectId: 'object' })
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
  })
  it.each(['quarantined', 'failed'])('blocks %s even when pending reads are allowed', async state => {
    await expect(fixture('false', state).createDownload('object', 'admin')).rejects.toThrow('安全校验')
    expect(getSignedUrl).not.toHaveBeenCalled()
  })
  it('blocks an incomplete pending upload', async () => {
    await expect(fixture('false', 'pending', '0').createDownload('object', 'admin')).rejects.toThrow('安全校验')
    expect(getSignedUrl).not.toHaveBeenCalled()
  })
  it('allows clean objects under strict scan requirements', async () => {
    await expect(fixture('true', 'clean').createDownload('object', 'admin')).resolves.toMatchObject({ objectId: 'object' })
  })
  it('accepts configured physical bucket names in legacy records and rejects unknown buckets', async () => {
    const service=new AdminStorageService({} as DataSource,new ConfigService({OBJECT_STORAGE_ENABLED:'true',S3_REGION:'test',S3_ACCESS_KEY:'test',S3_SECRET_KEY:'test',S3_BUCKET_MAP_JSON:JSON.stringify({'rwa-assets':'rwa-lat-assets'})}))
    jest.spyOn(service as any,'query').mockResolvedValue([])
    const row=jest.spyOn(service as any,'getObjectRow').mockResolvedValue({id:'legacy',bucket:'rwa-lat-assets',key:'old.png',size_bytes:'12',scan_status:'clean'})
    await expect(service.createDownload('legacy','admin')).resolves.toMatchObject({objectId:'legacy'})
    row.mockResolvedValue({id:'unknown',bucket:'foreign-bucket',key:'old.png',size_bytes:'12',scan_status:'clean'})
    await expect(service.createDownload('unknown','admin')).rejects.toThrow('不支持的存储桶')
  })
})
