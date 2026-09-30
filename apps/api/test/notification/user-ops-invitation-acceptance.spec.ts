import { ConflictException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { Invitation } from '../../src/notification/invitation.entity'
import { UserOpsService } from '../../src/notification/user-ops.service'

describe('UserOpsService invitation acceptance', () => {
  it('commits referral rewards once and safely replays acceptance for the same user', async () => {
    const token = 'invitation-token-1234567890'
    const invitation = {
      id: '00000000-0000-4000-8000-000000000010',
      inviter_user_id: '00000000-0000-4000-8000-000000000011',
      role: 'member',
      token_hash: createHash('sha256').update(token).digest(),
      state: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      created_at: new Date(),
    }
    const storedRewards: Array<Record<string, any>> = []
    const invitations = {
      findOne: jest.fn(async () => invitation),
      save: jest.fn(async (value) => value),
    }
    const rewards = {
      findOne: jest.fn(async ({ where }: any) => storedRewards.find((reward) =>
        reward.user_id === where.user_id && reward.ref_id === where.ref_id,
      )),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const saved = { ...value, id: `reward-${storedRewards.length + 1}` }
        storedRewards.push(saved)
        return saved
      }),
    }
    const inviteRepo = {
      manager: {
        transaction: (work: (manager: any) => Promise<unknown>) => work({
          getRepository: (entity: unknown) => entity === Invitation ? invitations : rewards,
        }),
      },
    }
    const service = new UserOpsService(
      {} as any,
      inviteRepo as any,
      {} as any,
      {} as any,
      rewards as any,
      {} as any,
      {} as any,
      {} as any,
    )

    const first = await service.acceptInvitation(token, '00000000-0000-4000-8000-000000000012')
    const replay = await service.acceptInvitation(token, '00000000-0000-4000-8000-000000000012')

    expect(first.invitation.state).toBe('accepted')
    expect(first.inviterReward.decimals).toBe(2)
    expect(first.inviterReward.amountAtomic).toBe('1000000')
    expect(replay.invitation.id).toBe(first.invitation.id)
    expect(replay.inviterReward.id).toBe(first.inviterReward.id)
    expect(replay.inviteeReward.id).toBe(first.inviteeReward.id)
    expect(storedRewards).toHaveLength(2)
    expect(invitations.save).toHaveBeenCalledTimes(1)
  })

  it('does not let a different user replay an accepted invitation', async () => {
    const token = 'invitation-token-1234567890'
    const invitation = {
      id: '00000000-0000-4000-8000-000000000010',
      inviter_user_id: '00000000-0000-4000-8000-000000000011',
      accepted_user_id: '00000000-0000-4000-8000-000000000012',
      role: 'member',
      token_hash: createHash('sha256').update(token).digest(),
      state: 'accepted',
      expires_at: new Date(Date.now() + 60_000),
      created_at: new Date(),
    }
    const inviteRepo = {
      manager: {
        transaction: (work: (manager: any) => Promise<unknown>) => work({
          getRepository: () => ({ findOne: jest.fn(async () => invitation) }),
        }),
      },
    }
    const service = new UserOpsService({} as any, inviteRepo as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)

    await expect(service.acceptInvitation(token, '00000000-0000-4000-8000-000000000013'))
      .rejects.toBeInstanceOf(ConflictException)
  })
})
