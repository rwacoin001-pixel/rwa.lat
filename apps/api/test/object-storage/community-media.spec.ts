import { ConfigService } from '@nestjs/config'
import * as presigner from '@aws-sdk/s3-request-presigner'
import type { Repository } from 'typeorm'
import type { ObjectStorageObject, PresignedUrl } from '../../src/object-storage/object-storage.entities'
import { COMMUNITY_IMAGE_MAX_BYTES, ObjectStorageService, communityMediaPath, sniffImageType } from '../../src/object-storage/object-storage.service'
import { communityMediaId } from '../../src/community/community.util'

const OWNER = '22222222-2222-2222-2222-222222222222'
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(24)])
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32)])
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

describe('community member media', () => {
  it('sniffs only the four accepted raster formats from bytes', () => {
    expect(sniffImageType(PNG)).toBe('image/png')
    expect(sniffImageType(JPEG)).toBe('image/jpeg')
    expect(sniffImageType(WEBP)).toBe('image/webp')
    expect(sniffImageType(GIF)).toBe('image/gif')
    expect(sniffImageType(SVG)).toBeNull()
    expect(sniffImageType(Buffer.from('%PDF-1.7 trailer'))).toBeNull()
  })

  it('round-trips the API-relative media reference and ignores external URLs', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(communityMediaId(communityMediaPath(id))).toBe(id)
    expect(communityMediaId('https://cdn.example.test/a.png')).toBeNull()
    expect(communityMediaId(`/v1/community/media/${id}/../x`)).toBeNull()
    expect(communityMediaId(null)).toBeNull()
  })

  it('stores a sniffed image as a pending, owner-tagged object in the private asset bucket', async () => {
    const { service, save, send } = harness()
    const result = await service.storeCommunityImage(OWNER, 'post', PNG, 'image/png')
    expect(send).toHaveBeenCalledTimes(1)
    const put = send.mock.calls[0][0].input
    expect(put).toMatchObject({ ContentType: 'image/png', ContentLength: PNG.length })
    expect(put.Key).toMatch(new RegExp(`^community/${OWNER}/post/[0-9a-f-]{36}\\.png$`))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'rwa-assets', scanStatus: 'pending', uploadedBy: OWNER, tags: { source: 'community-image', purpose: 'post' } }))
    expect(result).toMatchObject({ contentType: 'image/png', scanStatus: 'pending' })
  })

  it('rejects disguised, unsupported and oversized uploads before touching storage', async () => {
    const { service, send } = harness()
    await expect(service.storeCommunityImage(OWNER, 'post', SVG, 'image/png')).rejects.toMatchObject({ status: 400 })
    await expect(service.storeCommunityImage(OWNER, 'post', PNG, 'image/gif')).rejects.toMatchObject({ status: 400 })
    const big = Buffer.concat([JPEG, Buffer.alloc(COMMUNITY_IMAGE_MAX_BYTES.avatar)])
    await expect(service.storeCommunityImage(OWNER, 'avatar', big, 'image/jpeg')).rejects.toMatchObject({ status: 413 })
    expect(send).not.toHaveBeenCalled()
  })

  it('attaches only the caller’s own completed, non-rejected images of the right purpose', async () => {
    const good = row({ id: 'a1111111-1111-4111-8111-111111111111' })
    const { service, objects } = harness([good])
    await expect(service.attachableCommunityImages(OWNER, [good.id], 'post')).resolves.toEqual([good.id])
    expect(objects.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ bucket: 'rwa-assets', uploadedBy: OWNER }) }))
    await expect(service.attachableCommunityImages(OWNER, [good.id], 'avatar')).rejects.toMatchObject({ status: 400 })
    await expect(service.attachableCommunityImages(OWNER, [good.id, good.id], 'post')).rejects.toMatchObject({ status: 400 })
    for (const bad of [row({ scanStatus: 'quarantined' }), row({ scanStatus: 'failed' }), row({ sizeBytes: '0' }), row({ tags: { source: 'admin' } })]) {
      await expect(harness([bad]).service.attachableCommunityImages(OWNER, [bad.id], 'post')).rejects.toMatchObject({ status: 400 })
    }
  })

  it.each([undefined, 'false'])('shows only scan-cleared images (pending allowed only under an explicit waiver %p)', async requireScan => {
    const rows = (['clean', 'pending', 'quarantined', 'failed'] as const).map((scanStatus, i) => row({ id: `${i}1111111-1111-4111-8111-111111111111`, scanStatus }))
    const { service } = harness(rows, requireScan)
    const readable = await service.readableCommunityImageIds(rows.map(r => r.id))
    expect([...readable].sort()).toEqual(requireScan === 'false' ? [rows[0].id, rows[1].id].sort() : [rows[0].id])
  })

  it('serves a community image only through a signed inline URL after clearance', async () => {
    const signed = jest.spyOn(presigner, 'getSignedUrl').mockResolvedValue('https://storage.example.test/signed')
    try {
      await expect(harness([row({ scanStatus: 'clean' })]).service.createCommunityImageUrl(row().id)).resolves.toBe('https://storage.example.test/signed')
      await expect(harness([row({ scanStatus: 'pending' })]).service.createCommunityImageUrl(row().id)).rejects.toMatchObject({ status: 404 })
      await expect(harness([row({ scanStatus: 'clean', tags: {} })]).service.createCommunityImageUrl(row().id)).rejects.toMatchObject({ status: 404 })
    } finally { signed.mockRestore() }
  })
})

function row(overrides: Partial<ObjectStorageObject> = {}): ObjectStorageObject {
  return {
    id: 'b1111111-1111-4111-8111-111111111111', bucket: 'rwa-assets', key: `community/${OWNER}/post/x.png`, contentType: 'image/png',
    sizeBytes: '1024', expectedSizeBytes: '1024', checksumSha256: 'a'.repeat(64), checksumMd5: null, scanStatus: 'pending',
    scanProvider: null, scanReference: null, scanEventId: null, scannedAt: null, tags: { source: 'community-image', purpose: 'post' },
    uploadedBy: OWNER, uploadedAt: new Date(), presignedUrls: [], ...overrides,
  }
}

function harness(rows: ObjectStorageObject[] = [], requireScan?: string) {
  const save = jest.fn(async (value: Partial<ObjectStorageObject>) => ({ id: 'c1111111-1111-4111-8111-111111111111', ...value }))
  const objects = {
    find: jest.fn(async () => rows),
    findOne: jest.fn(async () => rows[0] ?? null),
    save,
    create: jest.fn((value) => value),
  }
  const service = new ObjectStorageService(
    new ConfigService({ OBJECT_STORAGE_ENABLED: 'true', S3_REGION: 'ap-southeast-1', S3_AUTH_MODE: 'static', S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 'test-secret-value-at-least-24-characters', OBJECT_STORAGE_REQUIRE_SCAN: requireScan }),
    objects as unknown as Repository<ObjectStorageObject>,
    {} as Repository<PresignedUrl>,
  )
  const send = jest.fn(async (_command: { input: Record<string, unknown> }) => ({}))
  ;(service as unknown as { s3: { send: typeof send } }).s3 = { send }
  return { service, save, send, objects }
}
