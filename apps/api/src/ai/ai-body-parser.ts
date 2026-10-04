import { BadRequestException, PayloadTooLargeException, type INestApplication } from '@nestjs/common'
import { json, type RequestHandler } from 'express'
import { CORE_API_PREFIX } from '../route-contract'

/** Larger transient image input is scoped to chat, before Nest's default parser. */
export function installAiChatBodyParser(app: Pick<INestApplication, 'use'>): void {
  app.use(`/${CORE_API_PREFIX}/ai/chat`, boundedJson('2mb'))
  // Nest skips its global JSON parser when one is already registered, even if
  // it is path-scoped. Restore the standard parser for every other endpoint.
  app.use(boundedJson('100kb'))
}

function boundedJson(limit: string): RequestHandler {
  const parser = json({ limit })
  return (request, response, next) => parser(request, response, error => {
    // The global application filter accepts Nest exceptions, not body-parser
    // errors. Normalize known input failures without returning raw body data.
    if (error?.type === 'entity.too.large') return next(new PayloadTooLargeException({ code: 'REQUEST_TOO_LARGE', message: 'The request exceeds the supported size.' }))
    if (error?.type === 'entity.parse.failed') return next(new BadRequestException({ code: 'REQUEST_JSON_INVALID', message: 'The JSON request is invalid.' }))
    next(error)
  })
}
