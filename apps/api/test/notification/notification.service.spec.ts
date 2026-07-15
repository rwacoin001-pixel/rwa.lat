import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { NotificationService } from '../../src/notification/notification.service'
import { Notification } from '../../src/notification/notification.entity'
import { NotificationError } from '../../src/notification/notification.errors'

const USER = '00000000-0000-0000-0000-000000000001'

function makeNote(over: Partial<Notification> = {}): Notification {
  const n = new Notification()
  n.id = 'n1'
  n.recipient_user_id = USER
  n.channel = 'in_app'
  n.kind = 'system'
  n.title = 't'
  n.read_at = undefined
  n.created_at = new Date()
  Object.assign(n, over)
  return n
}

describe('NotificationService', () => {
  let svc: NotificationService
  let repo: jest.Mocked<Repository<Notification>>

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((e) => Object.assign(new Notification(), e)) } },
      ],
    }).compile()
    svc = mod.get(NotificationService)
    repo = mod.get(getRepositoryToken(Notification))
  })

  it('listForUser filters unread', async () => {
    const read = makeNote({ id: 'r', read_at: new Date() })
    const unread = makeNote({ id: 'u', read_at: undefined })
    repo.find.mockResolvedValue([read, unread])
    const res = await svc.listForUser(USER, undefined, undefined, 'unread')
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('u')
  })

  it('markRead throws NOTIFICATION_NOT_FOUND when missing', async () => {
    repo.findOne.mockResolvedValue(null)
    await expect(svc.markRead('x', USER)).rejects.toBeInstanceOf(NotificationError)
    await expect(svc.markRead('x', USER)).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' })
  })

  it('markRead sets read_at when not read', async () => {
    const n = makeNote({ id: 'u', read_at: undefined })
    repo.findOne.mockResolvedValue(n)
    repo.save.mockResolvedValue(n)
    const res = await svc.markRead('u', USER)
    expect(res.readAt).toBeDefined()
    expect(repo.save).toHaveBeenCalledTimes(1)
  })

  it('markRead is idempotent when already read', async () => {
    const n = makeNote({ id: 'u', read_at: new Date() })
    repo.findOne.mockResolvedValue(n)
    const res = await svc.markRead('u', USER)
    expect(res.readAt).toBeDefined()
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('create persists a notification', async () => {
    const n = makeNote()
    repo.save.mockResolvedValue(n)
    const res = await svc.create({ recipient_user_id: USER, channel: 'in_app', kind: 'k', title: 't' })
    expect(res.id).toBe('n1')
    expect(repo.save).toHaveBeenCalledTimes(1)
  })
})
