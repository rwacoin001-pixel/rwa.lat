import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { DataGovernanceService } from '../../src/data-governance/data-governance.service'
import { BackupDrill, DataDeletionRequest } from '../../src/data-governance/data-governance.entities'

const ADMIN_1 = '00000000-0000-4000-8000-000000000001'
const ADMIN_2 = '00000000-0000-4000-8000-000000000002'

describe('DataGovernanceService (Pg)', () => {
  let ds: DataSource
  let svc: DataGovernanceService

  beforeAll(async () => {
    const opts = buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' })
    ds = new DataSource({
      ...opts,
      entities: [...(Array.isArray(opts.entities) ? opts.entities : []), BackupDrill, DataDeletionRequest],
    })
    await ds.initialize()
    await ds.query('DROP SCHEMA IF EXISTS app CASCADE')
    await ds.query('DROP TABLE IF EXISTS public.schema_migrations')
    await ds.runMigrations({ transaction: 'all' })

    svc = new DataGovernanceService(
      ds.getRepository(BackupDrill),
      ds.getRepository(DataDeletionRequest),
    )
  })

  afterAll(async () => {
    await ds.destroy()
  })

  it('requestDeletion sets retention window and requested state', async () => {
    const req = await svc.requestDeletion({
      subjectType: 'user',
      subjectId: 'u-1',
      requestedBy: ADMIN_1,
      retentionDays: 30,
    })
    expect(req.state).toBe('requested')
    const diffDays = (req.retainUntil.getTime() - req.requestedAt.getTime()) / 86_400_000
    expect(diffDays).toBeCloseTo(30, 0)
  })

  it('rejects invalid retention period', async () => {
    await expect(
      svc.requestDeletion({ subjectType: 'user', subjectId: 'u-2', requestedBy: ADMIN_1, retentionDays: -1 }),
    ).rejects.toThrow()
  })

  it('decideDeletion flips to approved then rejects re-decision', async () => {
    const req = await svc.requestDeletion({ subjectType: 'user', subjectId: 'u-3', requestedBy: ADMIN_1 })
    const approved = await svc.decideDeletion(req.id, true, ADMIN_2)
    expect(approved.state).toBe('approved')
    await expect(svc.decideDeletion(req.id, true, ADMIN_2)).rejects.toMatchObject({
      code: 'data_governance.deletion.already_decided',
    })
  })

  it('purgeExpired only clears approved requests past retention', async () => {
    const past = await svc.requestDeletion({ subjectType: 'user', subjectId: 'u-past', requestedBy: ADMIN_1, retentionDays: 0 })
    await svc.decideDeletion(past.id, true, ADMIN_2)
    const future = await svc.requestDeletion({ subjectType: 'user', subjectId: 'u-future', requestedBy: ADMIN_1, retentionDays: 30 })
    await svc.decideDeletion(future.id, true, ADMIN_2)

    const purged = await svc.purgeExpired(new Date(Date.now() + 1000))
    expect(purged).toBe(1)
    const list = await svc.listDeletions('purged')
    expect(list.length).toBe(1)
    expect(list[0].subjectId).toBe('u-past')
  })

  it('backup drill lifecycle: start -> finish succeeded', async () => {
    const drill = await svc.startDrill('full', ADMIN_1)
    expect(drill.status).toBe('running')
    const finished = await svc.finishDrill(drill.id, 'succeeded', 'ok')
    expect(finished.status).toBe('succeeded')
    expect(finished.finishedAt).not.toBeNull()
  })
})
