import { buildRwaAssistantPrompt, type RwaAssistantContext } from '../../src/ai/ai-assistant.policy'

describe('RWA assistant identity', () => {
  it('uses the A-REIT identity without exposing its configured provider or model', () => {
    const context = {
      locale: 'zh-CN',
      provider: 'DeepSeek',
      authenticated: false,
      mode: 'support',
    } as RwaAssistantContext & { provider: string }

    const prompt = buildRwaAssistantPrompt(context)

    expect(prompt).toContain('A-REIT AI assistant')
    expect(prompt).toMatch(/do not disclose.*(?:provider|model)|do not reveal.*(?:provider|model)/i)
    expect(prompt).not.toContain('DeepSeek')
    expect(prompt).not.toContain('modelProvider')
  })
})
