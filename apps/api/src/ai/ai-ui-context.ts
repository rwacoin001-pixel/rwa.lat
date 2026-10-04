import { BadRequestException } from '@nestjs/common'
import { PAGE_DIRECTORY } from './ai-platform-guide'

export function parseAiPageContext(input: unknown) {
  if (input === undefined) return undefined
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid page context')
  const value = input as Record<string, unknown>
  // Earlier clients supplied unused type/id fields; never forward arbitrary client context.
  if (value.pageKey === undefined) return undefined
  if (Object.keys(value).some(key => !['pageKey', 'tab'].includes(key))) throw new BadRequestException('Invalid page context')
  const page = PAGE_DIRECTORY.find(page => page.key === value.pageKey && page.domain !== 'ai')
  if (!page || (value.tab !== undefined && (page.key !== 'markets' || !['predictions', 'baskets', 'trade', 'assets'].includes(String(value.tab))))) throw new BadRequestException('Invalid page context')
  return { pageKey: page.key, path: page.path, title: page.title, ...(value.tab ? { tab: String(value.tab) } : {}) }
}
