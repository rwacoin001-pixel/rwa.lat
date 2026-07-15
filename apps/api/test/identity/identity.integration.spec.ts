import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { keccak_256 } from '@noble/hashes/sha3'
import { secp256k1 } from '@noble/curves/secp256k1'
import { randomUUID } from 'node:crypto'
import { AppModule } from '../../src/app.module'
import { IdentityService } from '../../src/identity/identity.service'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'
import { buildDatabaseOptions } from '../../src/database/database-options'

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

function signMessage(priv: Uint8Array, address: string, message: string): string {
  const pub = secp256k1.getPublicKey(priv, false)
  const derived = '0x' + Buffer.from(keccak_256(pub.subarray(1)).subarray(12)).toString('hex')
  if (derived.toLowerCase() !== address.toLowerCase()) throw new Error('address mismatch')
  const prefix = `\x19Ethereum Signed Message:\n${Buffer.byteLength(message)}${message}`
  const msgHash = keccak_256(Buffer.from(prefix, 'utf8'))
  const sig = secp256k1.sign(msgHash, priv)
  const rBytes = Buffer.from(sig.r.toString(16).padStart(64, '0'), 'hex')
  const sBytes = Buffer.from(sig.s.toString(16).padStart(64, '0'), 'hex')
  const sigBytes = Buffer.concat([rBytes, sBytes, Buffer.from([sig.recovery! + 27])])
  return '0x' + sigBytes.toString('hex')
}

describeDb('Identity API-002 integration', () => {
  let app: INestApplication
  let svc: IdentityService
  let dataSource: DataSource
  let delivery: IdentityDeliveryService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
    await app.init()
    svc = app.get(IdentityService)
    delivery = app.get(IdentityDeliveryService)
    dataSource = app.get(DataSource)
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it('registers, verifies email, and recovers', async () => {
    const email = `integration-${randomUUID()}@rwa.lat`
    const reg = await svc.registerEmail(email)
    expect(reg).toEqual({ accepted: true })
    const verificationToken = delivery.lastDemoToken(email, 'email_verification')
    expect(verificationToken).toBeTruthy()
    const verified = await svc.verifyEmail(verificationToken!)
    expect(verified.verified).toBe(true)
    const recovered = await svc.recover(email)
    expect(recovered).toEqual({ accepted: true })
    const recoveryToken = delivery.lastDemoToken(email, 'account_recovery')
    expect(recoveryToken).toBeTruthy()
    await expect(svc.confirmRecovery(recoveryToken!)).resolves.toMatchObject({ userId: verified.userId })
  })

  it('opens a session via a valid wallet signature', async () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const pub = secp256k1.getPublicKey(priv, false)
    const address = '0x' + Buffer.from(keccak_256(pub.subarray(1)).subarray(12)).toString('hex')
    const { nonce } = await svc.createWalletChallenge(address)
    const signature = signMessage(priv, address, nonce)
    const result = await svc.verifyWalletSignature(address, signature, nonce)
    expect(result.token).toHaveLength(64)
    expect(result.sessionId).toBeTruthy()
  })
})
