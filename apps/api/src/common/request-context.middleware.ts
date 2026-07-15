import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export type RequestWithContext = Request & { requestId?: string }

export class RequestContextMiddleware {
  use(request: RequestWithContext, response: Response, next: NextFunction) {
    const suppliedRequestId = request.header('x-request-id')
    const requestId = suppliedRequestId && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID()
    request.requestId = requestId
    response.locals.requestId = requestId
    response.setHeader('x-request-id', requestId)
    next()
  }
}
