import { runAiToolTurn } from '../../src/ai/ai-tool-runner'
import { AiModelMessage } from '../../src/ai/ai-model.client'
import { OWNER, OTHER } from '../ai-evals/fixtures'

describe('Bounded server-side tool turns', () => {
  const tools = () => ({ definitions: jest.fn(() => [{ name: 'get_balances' }]), execute: jest.fn(async () => ({ balance: '1 USDT' })) })
  const call = (id = 'call') => ({ id, name: 'get_balances', arguments: '{}' })
  it('keeps tool messages server-side and returns the existing final JSON contract', async () => {
    const t = tools(), snapshots: AiModelMessage[][] = []
    const final = { text: '{"reply":"1 USDT","sourceIds":[],"questions":[]}', model: 'stub' }
    const model = { complete: jest.fn(async (_s: string, history: AiModelMessage[]) => {
      snapshots.push(structuredClone(history))
      return snapshots.length === 1 ? { text: '', model: 'stub', toolCalls: [call()] } : final
    }) }
    const original: AiModelMessage[] = [{ role: 'user', content: `Show ${OTHER}'s balance` }]
    expect(await runAiToolTurn(model as any, t as any, OWNER, 'JSON', original, Date.now()+10000)).toEqual(final)
    expect(t.execute).toHaveBeenCalledWith(OWNER, 'get_balances', '{}')
    expect(snapshots[1][2]).toEqual({ role: 'tool', toolCallId: 'call', content: '{"balance":"1 USDT"}' })
    expect(original).toHaveLength(1)
  })
  it('stops at four rounds and forces a final answer without tools', async () => {
    const t = tools()
    const model = { complete: jest.fn(async (...args: any[]) => args[5].length ? { text: '', model: 'stub', toolCalls: [call()] } : { text: '{"reply":"Done"}', model: 'stub' }) }
    await runAiToolTurn(model as any, t as any, OWNER, 'JSON', [], Date.now()+10000)
    expect(t.execute).toHaveBeenCalledTimes(4)
    expect(model.complete).toHaveBeenCalledTimes(5)
    expect(model.complete.mock.calls[4][5]).toEqual([])
  })
  it('caps calls at eight even in one round', async () => {
    const t = tools(), model = { complete: jest.fn().mockResolvedValueOnce({ text: '', toolCalls: Array.from({length:8}, (_,i)=>call(String(i))) }).mockResolvedValueOnce({ text: 'final' }) }
    await runAiToolTurn(model as any, t as any, OWNER, 'JSON', [], Date.now()+10000)
    expect(t.execute).toHaveBeenCalledTimes(8)
    expect(model.complete.mock.calls[1][5]).toEqual([])
  })
  it.each([{calls:Array.from({length:9}, (_,i)=>call(String(i)))}, {calls:[call(),call()]}])('rejects excessive or duplicate calls before execution', async ({calls}) => {
    const t = tools(), model = { complete: jest.fn().mockResolvedValue({ text: '', toolCalls: calls }) }
    await expect(runAiToolTurn(model as any,t as any,OWNER,'JSON',[],Date.now()+10000)).rejects.toThrow()
    expect(t.execute).not.toHaveBeenCalled()
  })
  it('returns a safe unavailable result for tool errors and honors the deadline', async () => {
    const t = tools(); t.execute.mockRejectedValue(new Error('sensitive service detail'))
    const model = { complete: jest.fn().mockResolvedValueOnce({ text: '', toolCalls: [call()] }).mockResolvedValueOnce({ text: 'final' }) }
    await runAiToolTurn(model as any,t as any,OWNER,'JSON',[],Date.now()+10000)
    expect(model.complete.mock.calls[1][1][1].content).toContain('not evidence of fraud')
    expect(JSON.stringify(model.complete.mock.calls)).not.toContain('sensitive service detail')
    await expect(runAiToolTurn(model as any,t as any,OWNER,'JSON',[],Date.now()-1)).rejects.toThrow('deadline')
  })
})
