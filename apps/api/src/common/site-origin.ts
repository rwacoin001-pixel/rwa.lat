import type { Request } from 'express'
import { verifiedEdgeClient } from './edge-client'

export const KIMENG_ORIGIN = 'https://kimengresearch.com'

export function isKimengRequest(request: Request | undefined): boolean {
  return !!request?.res && verifiedEdgeClient(request.res)?.brand === 'kimeng'
}

export function kimengOrigin(request: Request | undefined): string | undefined {
  return isKimengRequest(request) ? KIMENG_ORIGIN : undefined
}
