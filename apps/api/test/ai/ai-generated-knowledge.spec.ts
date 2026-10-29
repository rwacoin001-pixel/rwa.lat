import { ConfigService } from '@nestjs/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AiKnowledgeService } from '../../src/ai/ai-knowledge.service'
import { AdminAiKnowledgeController } from '../../src/ai/ai-knowledge.controller'
import { OWNER, RECORD, OTHER } from '../ai-evals/fixtures'

const article = (id = RECORD, body = 'Current published copy') => ({ id, content: { title:'Knowledge',summary:'Summary',body,locale:'en',visibility:'public',category:'generated-app-copy',productIds:[],effectiveAt:null,expiresAt:null } })
function fixture(rows: any[] = []) {
  const versions = new Set<string>()
  const query = jest.fn(async (sql: string, args: any[] = []): Promise<any[]> => {
    if(sql.startsWith('SELECT id,revision,draft,published')) return rows
    if(sql.startsWith('INSERT INTO app.ai_knowledge_items')) {
      const row = rows.find(r=>r.id===args[0])
      const fields = {id:args[0],draft:JSON.parse(args[2]),revision:args[3],archivedAt:null}
      if(row) Object.assign(row,fields); else rows.push(fields)
    }
    if(sql.startsWith('INSERT INTO app.ai_knowledge_versions')) versions.add(`${args[0]}:${args[1]}`)
    if(sql.includes('SET published=draft')) { const row = rows.find(r=>r.id===args[0]); row.published=row.draft; row.archivedAt=null }
    if(sql.includes('SET archived_at=now()')) rows.find(r=>r.id===args[0]).archivedAt='now'
    return []
  })
  const ds = { transaction: (fn: any)=>fn({query}) }
  return {service:new AiKnowledgeService(ds as any,new ConfigService()),query,rows,versions}
}
describe('Versioned generated knowledge', () => {
  it('publishes once, skips unchanged content, versions changes and archives stale generated items', async () => {
    const f = fixture()
    expect(await f.service.syncGenerated([article()])).toEqual({published:1,archived:0,unchanged:0})
    expect(await f.service.syncGenerated([article()])).toEqual({published:0,archived:0,unchanged:1})
    expect(await f.service.syncGenerated([article(RECORD,'Changed copy')])).toMatchObject({published:1})
    expect([...f.versions]).toEqual([`${RECORD}:1`,`${RECORD}:2`])
    expect(await f.service.syncGenerated([article(OTHER)])).toEqual({published:1,archived:1,unchanged:0})
    expect(f.rows.find(r=>r.id===RECORD).archivedAt).toBe('now')
    const audits = f.query.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO app.audit_logs'))
    expect(audits.map(([,args])=>args![2])).toEqual(['ai.knowledge.saved','ai.knowledge.published','ai.knowledge.saved','ai.knowledge.published','ai.knowledge.saved','ai.knowledge.published','ai.knowledge.archived'])
    expect(audits.every(([,args])=>args![6]==='service')).toBe(true)
  })
  it('rejects empty manifests, duplicate IDs and manual-article collisions before overwriting', async () => {
    const f = fixture([{id:RECORD,revision:1,draft:{category:'manual'}}])
    await expect(f.service.syncGenerated([])).rejects.toThrow()
    await expect(f.service.syncGenerated([article(),article()])).rejects.toThrow()
    await expect(f.service.syncGenerated([article()])).rejects.toThrow('manual')
    expect(f.query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false)
  })
  it('commits bilingual app copy with stable IDs, bounded articles, quant research and every emitted notice', () => {
    const all = ['zh','en'].flatMap(locale=>JSON.parse(readFileSync(resolve(__dirname,`../../src/ai/knowledge/generated/${locale}.json`),'utf8')))
    expect(new Set(all.map(a=>a.id)).size).toBe(all.length)
    for(const a of all) { expect(a.content.body.length).toBeLessThanOrEqual(6000); expect(a.content.visibility).toBe('public') }
    for(const locale of ['zh-CN','en']) {
      const text = all.filter(a=>a.content.locale===locale).map(a=>a.content.body).join('\n')
      for(const name of ['QuantResearch.tsx','QuantCover.tsx','QuantFactsheet.tsx','ReferralRules.tsx','maison-wallet-copy.ts','maison-trust-copy.ts']) expect(text).toContain(name)
      for(const kind of ['quant.settled','quant.redemption.settled','quant.redemption.rejected','wallet.quant_daily_settlement','security.new_device']) expect(all.some(a=>a.content.locale===locale && a.content.title.startsWith(kind))).toBe(true)
    }
  })
  it('requires the existing admin permission before listing negative answers', async () => {
    const knowledge = {negativeFeedback:jest.fn(async()=>[])}, rbac = {assertPermission:jest.fn(async()=>{})}
    const controller = new AdminAiKnowledgeController(knowledge as any,rbac as any,{} as any)
    await controller.feedback({id:OWNER} as any)
    expect(rbac.assertPermission).toHaveBeenCalledWith(OWNER,'platform.manage')
    expect(knowledge.negativeFeedback).toHaveBeenCalledWith(OWNER)
    rbac.assertPermission.mockRejectedValue(new Error('Forbidden'))
    await expect(controller.feedback({id:OTHER} as any)).rejects.toThrow('Forbidden')
    expect(knowledge.negativeFeedback).toHaveBeenCalledTimes(1)
  })
  it('bounds and audits the feedback review without including bodies in audit metadata', async () => {
    const f = fixture()
    await f.service.negativeFeedback(OWNER)
    expect(f.query.mock.calls[0][0]).toContain('m.helpful=false')
    expect(f.query.mock.calls[0][0]).toContain('LIMIT 100')
    expect(f.query.mock.calls[1][1]![2]).toBe('ai.feedback.reviewed')
    expect(JSON.parse(f.query.mock.calls[1][1]![5])).toEqual({rowCount:0})
  })
})
