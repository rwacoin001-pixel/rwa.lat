import { EntityManager, Repository } from 'typeorm'
import { NotificationService } from '../../src/notification/notification.service'
import { Notification } from '../../src/notification/notification.entity'

describe('Community DM notifications', () => {
  const service = new NotificationService({} as Repository<Notification>)
  it('atomically upserts only unread in-app notifications for the recipient/thread', async () => {
    const query = jest.fn().mockResolvedValue([])
    await service.coalesceCommunityDm({ query } as unknown as EntityManager, 'recipient', 'thread', 'alice.sg')
    const [sql, args] = query.mock.calls[0]
    expect(sql).toContain('ON CONFLICT')
    expect(sql).toContain("(payload->>'threadId')")
    expect(sql).toContain("kind='community.dm' AND channel='in_app' AND read_at IS NULL")
    expect(sql).toContain('DO UPDATE SET')
    expect(args[0]).toBe('recipient')
    expect(JSON.parse(args[2])).toEqual({ threadId: 'thread', fromHandle: 'alice.sg', route: '/community/messages/thread' })
  })
  it('marks only that recipient/thread unread notification as read', async () => {
    const query = jest.fn().mockResolvedValue([])
    await service.readCommunityDm({ query } as unknown as EntityManager, 'recipient', 'thread')
    const [sql, args] = query.mock.calls[0]
    expect(sql).toContain('recipient_user_id=$1')
    expect(sql).toContain("payload->>'threadId'=$2")
    expect(sql).toContain('read_at IS NULL')
    expect(args).toEqual(['recipient', 'thread'])
  })
})
