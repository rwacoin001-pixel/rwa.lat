import { AiNotificationDigestService, ruleLine } from '../../src/ai/ai-notification-digest.service'

const note = (id: string, title: string, body = '') => ({ id, recipientUserId: 'u1', channel: 'in_app', kind: 'k', title, body, payload: {}, createdAt: new Date() })

function service(unread: ReturnType<typeof note>[], model: { configured: boolean; complete?: jest.Mock }) {
  const notifications = { listForUser: jest.fn().mockResolvedValue(unread) }
  return { svc: new AiNotificationDigestService(notifications as never, model as never), notifications }
}

describe('AiNotificationDigestService', () => {
  it('returns nothing when there is nothing unread', async () => {
    const { svc } = service([], { configured: true, complete: jest.fn() })
    await expect(svc.digest('u1', 'zh-CN')).resolves.toEqual({ summary: null, count: 0, source: 'none' })
  })

  it('falls back to a plain line when the model is not configured', async () => {
    const { svc } = service([note('a', '考拉量化 10-24 已结算'), note('b', '充值到账 500 USDT'), note('c', '新设备登录')], { configured: false })
    await expect(svc.digest('u1', 'zh-CN')).resolves.toEqual({ summary: '3 条新消息：考拉量化 10-24 已结算、充值到账 500 USDT 等。', count: 3, source: 'rule' })
  })

  it('uses the model sentence and caches it for the same unread set', async () => {
    const complete = jest.fn().mockResolvedValue({ text: '“考拉量化已结算，500 USDT 已到账。”', model: 'm' })
    const { svc } = service([note('a', '考拉量化 10-24 已结算'), note('b', '充值到账 500 USDT')], { configured: true, complete })
    await expect(svc.digest('u1', 'zh-CN')).resolves.toEqual({ summary: '考拉量化已结算，500 USDT 已到账。', count: 2, source: 'ai' })
    await svc.digest('u1', 'zh-CN')
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('rejects promise-like wording and a failing model, falling back to the plain line', async () => {
    const promising = jest.fn().mockResolvedValue({ text: '收益保证稳赚', model: 'm' })
    const a = service([note('a', 'Settled')], { configured: true, complete: promising })
    await expect(a.svc.digest('u1', 'en')).resolves.toMatchObject({ source: 'rule' })
    const failing = jest.fn().mockRejectedValue(new Error('timeout'))
    const b = service([note('a', 'Settled')], { configured: true, complete: failing })
    await expect(b.svc.digest('u1', 'en')).resolves.toEqual({ summary: '1 new: Settled.', count: 1, source: 'rule' })
  })

  it('writes the plain line in English for other locales', () => {
    expect(ruleLine([{ title: 'A' }, { title: 'B' }, { title: 'C' }], 'fr')).toBe('3 new: A; B; and more.')
  })
})
