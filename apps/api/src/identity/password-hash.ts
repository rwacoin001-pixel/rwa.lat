import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'

const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
})
export function assertPassword(password: string): void {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new BadRequestException({ code: 'AUTH_PASSWORD_POLICY', message: 'Use 12–128 characters.' })
  }
}
export async function hashPassword(password: string): Promise<string> {
  assertPassword(password)
  const salt = randomBytes(16).toString('hex')
  return `scrypt$32768$${salt}$${(await derive(password, salt)).toString('hex')}`
}
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = stored?.split('$')
  const valid = parts?.length === 4 && parts[0] === 'scrypt' && parts[1] === '32768'
    && /^[a-f0-9]{32}$/.test(parts[2]) && /^[a-f0-9]{64}$/.test(parts[3])
  // Unknown identities perform the same expensive work as existing passwords.
  const actual = await derive(password, valid ? parts![2] : '0'.repeat(32))
  const expected = Buffer.from(valid ? parts![3] : '0'.repeat(64), 'hex')
  return timingSafeEqual(actual, expected) && Boolean(valid)
}
