import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestHandler } from 'express'
import { verifiedEdgeClient } from './edge-client'

type Brand = 'kimeng' | undefined
const requestBrand = new AsyncLocalStorage<Brand>()

/** Only the authenticated edge middleware can establish the request brand. */
export const createBrandContextMiddleware = (): RequestHandler => (_request, response, next) => {
  const brand = verifiedEdgeClient(response)?.brand
  requestBrand.run(brand, next)
}

export function currentBrand(): Brand {
  return requestBrand.getStore()
}
