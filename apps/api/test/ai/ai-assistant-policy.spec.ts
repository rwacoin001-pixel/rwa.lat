import { buildRwaAssistantPrompt, type RwaAssistantContext } from '../../src/ai/ai-assistant.policy'

describe('RWA assistant identity', () => {
  it('identifies as Kimeng when the verified request comes from Kimeng', () => {
    const prompt = buildRwaAssistantPrompt({ brand: 'kimeng', locale: 'zh-CN', authenticated: false, mode: 'support' })
    expect(prompt).toContain('identify yourself as the KIMENG (金英) AI assistant')
    expect(prompt).not.toContain('identify yourself as the A-REIT AI assistant')
  })
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
