import { ConfigService } from '@nestjs/config'
import { ObjectStorageService } from '../../src/object-storage/object-storage.service'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
jest.mock('@aws-sdk/s3-request-presigner',()=>({getSignedUrl:jest.fn(async()=> 'https://storage.test/signed')}))
describe('Published legacy asset references',()=> {
  it('reads only the configured asset bucket, preserving private KYC and unknown-bucket boundaries',async()=> {
    const objects={findOne:jest.fn().mockResolvedValue({scanStatus:'clean',sizeBytes:'12',contentType:'image/png'})}
    const service=new ObjectStorageService(new ConfigService({OBJECT_STORAGE_ENABLED:'true',S3_REGION:'test',S3_ACCESS_KEY:'test',S3_SECRET_KEY:'test',S3_BUCKET_MAP_JSON:JSON.stringify({'rwa-assets':'rwa-lat-assets','rwa-kyc':'rwa-lat-kyc'})}),objects as any,{} as any)
    await expect(service.createPublishedAssetUrl('rwa-lat-assets/old.png',true)).resolves.toBe('https://storage.test/signed')
    expect(objects.findOne).toHaveBeenCalledWith({where:{bucket:'rwa-lat-assets',key:'old.png'}})
    await expect(service.createPublishedAssetUrl('rwa-lat-kyc/private.png',true)).rejects.toMatchObject({status:404})
    await expect(service.createPublishedAssetUrl('foreign/old.png',true)).rejects.toMatchObject({status:404})
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
  })
})
