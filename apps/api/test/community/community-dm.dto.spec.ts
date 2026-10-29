import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DmHandleDto, DmMessagesQueryDto, DmReadDto, DmSendDto, DmSettingsDto } from '../../src/community/community-dm.dto'
import { MemberProfileDto } from '../../src/community/community-member.dto'
import { riskyDm } from '../../src/community/community-dm.policy'

describe('DM validation and post moderation parity', () => {
  it('trims message bodies and rejects blank, oversized, invalid id and client-supplied sender', () => {
    const input = { body: ' Hello ', clientId: '00000000-0000-4000-8000-000000000001' }
    expect(plainToInstance(DmSendDto, input).body).toBe('Hello')
    for (const change of [{ body: ' ' }, { body: 'x'.repeat(2001) }, { clientId: 'bad' }, { senderProfileId: 'forged' }, { userId: 'forged' }]) {
      expect(validateSync(plainToInstance(DmSendDto, { ...input, ...change }), { whitelist: true, forbidNonWhitelisted: true }).length).toBeGreaterThan(0)
    }
  })
  it('bounds pagination and validates handles, read cursors and thread settings', () => {
    expect(validateSync(plainToInstance(DmMessagesQueryDto, { limit: '50' }))).toEqual([])
    for (const input of [{ limit: 51 }, { limit: 0 }, { limit: 1.5 }, { before: 'bad' }]) {
      expect(validateSync(plainToInstance(DmMessagesQueryDto, input)).length).toBeGreaterThan(0)
    }
    expect(validateSync(plainToInstance(DmReadDto, { messageId: 'bad' })).length).toBeGreaterThan(0)
    expect(validateSync(plainToInstance(DmHandleDto, { handle: 'bob.sg' }))).toEqual([])
    expect(validateSync(plainToInstance(DmHandleDto, { handle: '../other' })).length).toBeGreaterThan(0)
    expect(validateSync(plainToInstance(DmSettingsDto, { muted: 'true' })).length).toBeGreaterThan(0)
  })
  it('accepts only the two DM policies on the existing profile DTO', () => {
    const p = { displayName: 'Alice', handle: 'alice' }
    for (const dmPolicy of ['everyone', 'following']) expect(validateSync(plainToInstance(MemberProfileDto, { ...p, dmPolicy }))).toEqual([])
    expect(validateSync(plainToInstance(MemberProfileDto, { ...p, dmPolicy: 'friends' })).length).toBeGreaterThan(0)
  })
  it('uses exactly the existing post contact/solicitation patterns', () => {
    const patterns = (file: string) => readFileSync(resolve(__dirname, file), 'utf8').split('\n').map(line => line.trim()).filter(line => line.startsWith('/') && !line.startsWith('//') && !line.startsWith('/*'))
    expect(patterns('../../src/community/community-dm.policy.ts')).toEqual(patterns('../../../../lib/community-guard.ts'))
    for (const body of ['微信联系', 'wa.me/123', 'risk-free profit', '保本', '13812345678']) expect(riskyDm(body)).toBe(true)
    for (const body of ['Hello there', 'The price is 2000', '2026-10-29']) expect(riskyDm(body)).toBe(false)
  })
})
