import { AiService } from '../../src/ai/ai.service'
import type { AiModelClient } from '../../src/ai/ai-model.client'
import type { AiChatMessage } from '../../src/ai/ai-message.entity'
import type { AiChatSession } from '../../src/ai/ai-session.entity'
import type { Repository } from 'typeorm'

describe('AI public status contract', () => {
  const makeService = (configured: boolean) => new AiService(
    {} as Repository<AiChatSession>,
    {} as Repository<AiChatMessage>,
    { configured, modelName: 'test-model', providerName: 'test-provider' } as AiModelClient,
  )

  it.each([true, false])('keeps legacy and current client fields aligned when configured=%s', (configured) => {
    expect(makeService(configured).status).toEqual({
      enabled: configured,
      available: configured,
      configured,
      model: 'test-model',
      provider: 'test-provider',
    })
  })
})
