import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AdminModule } from './admin.module'
import { AdminSessionGuard } from './admin-session.guard'
import { ADMIN_API_PREFIX } from './route-contract'
import { createAdminRateLimitMiddleware, createAdminRequestContextMiddleware } from './admin-edge.middleware'
import type { Server } from 'node:http'

async function bootstrap() {
  const app = await NestFactory.create(AdminModule, { bufferLogs: true })
  const express = app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void }
  express.set('trust proxy', proxyHops(process.env.TRUST_PROXY_HOPS))
  app.use(helmet())
  app.enableCors({ origin: (process.env.ADMIN_CORS_ORIGINS ?? 'http://localhost:3100').split(',').map((s) => s.trim()).filter(Boolean), credentials: true })
  app.use(createAdminRequestContextMiddleware())
  app.use(createAdminRateLimitMiddleware())
  const prefix = ADMIN_API_PREFIX
  app.setGlobalPrefix(prefix)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
  app.useGlobalGuards(app.get(AdminSessionGuard))

  const port = Number(process.env.PORT ?? 4100)
  const server = await app.listen(port) as Server
  server.requestTimeout = 30_000
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5_000
  server.maxHeadersCount = 100
  server.maxRequestsPerSocket = 500
  // eslint-disable-next-line no-console
  console.log(`RWA.LAT Admin listening on :${port} (prefix=${prefix})`)
}

function proxyHops(value: string | undefined): number {
  const parsed = Number(value ?? '0')
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10 ? parsed : 0
}

void bootstrap()
