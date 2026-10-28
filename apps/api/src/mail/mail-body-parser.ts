import { BadRequestException, PayloadTooLargeException, type INestApplication } from '@nestjs/common'
import { json, type Request } from 'express'
import { CORE_API_PREFIX } from '../route-contract'

export function installMailBodyParser(app: Pick<INestApplication, 'use'>) {
  const parser = json({ limit: '16mb', inflate: false, verify: (req, _res, body) => { (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(body) } })
  app.use(`/${CORE_API_PREFIX}/internal/inbound-email`, (req: Request, res: Parameters<typeof parser>[1], next: Parameters<typeof parser>[2]) => {
    parser(req, res, error => next(error ? error.type === 'entity.too.large' ? new PayloadTooLargeException('Inbound email is too large') : new BadRequestException('Invalid inbound email body') : undefined))
  })
}
