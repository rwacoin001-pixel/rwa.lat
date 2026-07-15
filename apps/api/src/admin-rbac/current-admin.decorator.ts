import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { AdminAuthenticatedRequest } from './admin-session.guard'

export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>()
  return request.admin
})
