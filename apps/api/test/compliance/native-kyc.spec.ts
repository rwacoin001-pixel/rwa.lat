import { NativeKycService, validateKycImage } from '../../src/compliance/native-kyc.service'
import type { KycProvider, NativeKycChecks } from '../../src/compliance/kyc-provider.interface'
import { KycCase } from '../../src/compliance/kyc-case.entity'

const key = '11111111-1111-4111-8111-111111111111'
const image = () => ({ buffer: Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(32)]), mimetype: 'image/jpeg' })
const checks = (): NativeKycChecks => ({ references: [key, key, key], document: { status: 'Approved', warnings: [] }, liveness: { status: 'Approved', score: 99, warnings: [] }, faceMatch: { status: 'Approved', score: 99, warnings: [] } })
function fixture(enabled = true) {
  const rows: KycCase[] = []
  const repo = {
    findOne: jest.fn(async ({ where }: { where: Partial<KycCase> }) => rows.filter(row => Object.entries(where).every(([field, value]) => Buffer.isBuffer(value) ? value.equals(row[field as keyof KycCase] as Buffer) : row[field as keyof KycCase] === value)).at(-1) ?? null),
    create: (row: Partial<KycCase>) => ({ ...row, createdAt: new Date(), updatedAt: new Date() }),
    save: jest.fn(async (row: KycCase) => { if (!rows.includes(row)) rows.push(row); return row }),
    manager: { transaction: jest.fn(async (work: (manager: unknown) => unknown): Promise<unknown> => work({ query: jest.fn(), getRepository: () => repo })) },
  }
  const provider = { name: 'didit', mode: 'live', verifyImages: jest.fn().mockResolvedValue(checks()) } as unknown as KycProvider
  const crypto = { hmac: (value: string) => Buffer.from(require('node:crypto').createHash('sha256').update(value).digest()), encrypt: (value: string) => ({ ciphertext: Buffer.from(value), keyVersion: 1 }), decrypt: (value: Buffer) => value.toString() }
  const service = new NativeKycService(repo as never, provider, crypto as never, { get: () => enabled ? 'true' : 'false' } as never)
  const files = { front: [image()], selfie: [image()] }
  return { service, provider, files, rows, repo }
}

describe('Native KYC capture boundary', () => {
  it('keeps the new paid flow disabled until explicitly enabled', async () => {
    const { service, provider, files } = fixture(false)
    await expect(service.capture('user', key, 'passport', files)).rejects.toMatchObject({ status: 503 })
    expect(provider.verifyImages).not.toHaveBeenCalled()
  })
  it('requires the back of a two-sided document before calling the provider', async () => {
    const { service, provider, files } = fixture()
    await expect(service.capture('user', key, 'id_card', files)).rejects.toMatchObject({ status: 400 })
    expect(provider.verifyImages).not.toHaveBeenCalled()
  })
  it('rejects a renamed non-image and oversized uploads', () => {
    expect(() => validateKycImage({ buffer: Buffer.alloc(32), mimetype: 'image/jpeg' })).toThrow()
    expect(() => validateKycImage({ buffer: Buffer.alloc(5 * 1024 * 1024 + 1), mimetype: 'image/jpeg' })).toThrow()
  })
  it('approves only three clean checks, retaining references rather than images', async () => {
    const { service, provider, files, rows } = fixture()
    const row = await service.capture('user', key, 'passport', files)
    expect(row.state).toBe('approved')
    expect(row.submittedAt).toBeInstanceOf(Date)
    expect(provider.verifyImages).toHaveBeenCalledTimes(1)
    expect(rows).toHaveLength(1)
    expect(row.providerCaseCiphertext.toString()).not.toContain(files.front[0].buffer.toString('base64'))
  })
  it.each(['document', 'liveness', 'faceMatch'] as const)('never approves a declined %s check', async part => {
    const { service, provider, files } = fixture()
    const result = checks(); result[part].status = 'Declined'
    ;(provider.verifyImages as jest.Mock).mockResolvedValue(result)
    expect((await service.capture('user', key, 'passport', files)).state).toBe('rejected')
  })
  it.each(['low-score', 'warning'])('routes %s to review with all mandatory checks preserved', async kind => {
    const { service, provider, files } = fixture()
    const result = checks()
    if (kind === 'low-score') result.faceMatch.score = 50
    else result.document.warnings = ['DOCUMENT_NUMBER_FORMAT_MISMATCH']
    ;(provider.verifyImages as jest.Mock).mockResolvedValue(result)
    const row = await service.capture('user', key, 'passport', files)
    expect(row.state).toBe('submitted'); expect(row.decidedAt).toBeNull()
  })
  it('does not rebill an identical retry and rejects payload reuse', async () => {
    const { service, provider, files } = fixture()
    const row = await service.capture('user', key, 'passport', files)
    expect(await service.capture('user', key, 'passport', files)).toBe(row)
    files.selfie[0].buffer[15] = 2
    await expect(service.capture('user', key, 'passport', files)).rejects.toMatchObject({ status: 409 })
    expect(provider.verifyImages).toHaveBeenCalledTimes(1)
  })
  it('keeps a lost provider response out of review and consumes the attempt key', async () => {
    const { service, provider, files, rows } = fixture()
    ;(provider.verifyImages as jest.Mock).mockRejectedValue(new Error('timeout'))
    await expect(service.capture('user', key, 'passport', files)).rejects.toMatchObject({ status: 503 })
    expect(rows[0].state).toBe('needs_information'); expect(rows[0].submittedAt).toBeNull()
    expect((await service.capture('user', key, 'passport', files)).state).toBe('needs_information')
    expect(provider.verifyImages).toHaveBeenCalledTimes(1)
  })
})
