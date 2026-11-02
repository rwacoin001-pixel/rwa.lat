import { BadRequestException } from '@nestjs/common'
import { validateSync } from 'class-validator'
import { AuthFlowCompleteDto } from '../../src/identity/dto/password-auth.dto'
import { assertPassword, hashPassword, verifyPassword } from '../../src/identity/password-hash'

describe('password policy', () => {
  it.each([7, 129])('rejects %i characters with the policy message', length => {
    expect(() => assertPassword('a'.repeat(length))).toThrow(new BadRequestException({
      code: 'AUTH_PASSWORD_POLICY', message: 'Use 8–128 characters.',
    }))
  })

  it.each([8, 128])('accepts %i characters', length => {
    expect(() => assertPassword('a'.repeat(length))).not.toThrow()
  })

  it('hashes and verifies an 8-character password', async () => {
    const password = 'abcdefgh'
    const hash = await hashPassword(password)
    expect(await verifyPassword(password, hash)).toBe(true)
  })

  it('rejects a 7-character password before hashing', async () => {
    await expect(hashPassword('abcdefg')).rejects.toBeInstanceOf(BadRequestException)
  })

  it.each<[number, boolean]>([
    [7, false], [8, true], [128, true], [129, false],
  ])('validates flow-completion passwords of length %i (valid: %s)', (length, valid) => {
    const dto = Object.assign(new AuthFlowCompleteDto(), {
      continuationToken: 'a'.repeat(64), password: 'a'.repeat(length),
    })
    const errors = validateSync(dto).filter(error => error.property === 'password')
    expect(errors.length === 0).toBe(valid)
  })
})
