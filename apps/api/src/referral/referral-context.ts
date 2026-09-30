import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'

@Injectable()
export class ReferralContext {
  private readonly storage = new AsyncLocalStorage<{ token?: string }>()
  token() { return this.storage.getStore()?.token }
  run<T>(token: string | undefined, work: () => T): T { return this.storage.run({ token }, work) }
}
