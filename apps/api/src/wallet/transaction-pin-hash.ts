import { BadRequestException } from '@nestjs/common'
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export function assertTransactionPin(pin: string): void {
  if (typeof pin !== 'string' || !/^[0-9]{6}$/.test(pin)) {
    throw new BadRequestException({ code: 'TRANSACTION_PIN_POLICY', message: 'Use exactly six digits.' })
  }
}
// Dedicated PIN KDF, separate from the login password policy. OWASP's 32 MiB scrypt configuration.
const derive = (pin: string, userId: string, pepper: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  const secret = createHmac('sha256', pepper).update(`rwa:transaction-pin:v1:${userId}:`).update(pin).digest()
  scrypt(secret, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    secret.fill(0)
    if (error) reject(error); else resolve(key)
  })
})
export async function hashTransactionPin(pin: string, userId: string, pepper: string): Promise<string> {
  assertTransactionPin(pin)
  const salt = randomBytes(16).toString('hex')
  return `pin-v1$scrypt$32768$8$3$${salt}$${(await derive(pin, userId, pepper, salt)).toString('hex')}`
}
export async function verifyTransactionPin(pin: string, userId: string, pepper: string, stored: string): Promise<boolean> {
  assertTransactionPin(pin)
  const parts = stored.split('$')
  const valid = parts.length === 7 && parts.slice(0, 5).join('$') === 'pin-v1$scrypt$32768$8$3'
    && /^[a-f0-9]{32}$/.test(parts[5]) && /^[a-f0-9]{64}$/.test(parts[6])
  const actual = await derive(pin, userId, pepper, valid ? parts[5] : '0'.repeat(32))
  return timingSafeEqual(actual, Buffer.from(valid ? parts[6] : '0'.repeat(64), 'hex')) && valid
}
