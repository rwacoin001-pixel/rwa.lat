import 'dotenv/config'
import './observability/instrumentation'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/http-exception.filter'
import { RequestContextMiddleware } from './common/request-context.middleware'
import { CORE_API_PREFIX } from './route-contract'
import { createApiRateLimitMiddleware } from './common/api-rate-limit.middleware'
import type { Server } from 'node:http'

function parseOrigins(value: string | undefined) {
  return (value ?? 'http://localhost:3030,http://localhost:3100')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const prefix = CORE_API_PREFIX
  const express = app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void }
  express.set('trust proxy', parseTrustProxyHops(process.env.TRUST_PROXY_HOPS))

  app.use(helmet())
  app.enableCors({ origin: parseOrigins(process.env.CORS_ORIGINS), credentials: true })
  app.use(new RequestContextMiddleware().use)
  app.use(createApiRateLimitMiddleware())
  app.setGlobalPrefix(prefix)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
  app.useGlobalFilters(new HttpExceptionFilter())

  const openApiConfig = new DocumentBuilder()
    .setTitle('RWA.LAT API')
    .setDescription('Versioned API contracts for the RWA.LAT investment application.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig)
  SwaggerModule.setup('docs', app, openApiDocument, { useGlobalPrefix: true })

  const server = await app.listen(Number(process.env.PORT ?? 4000)) as Server
  server.requestTimeout = 30_000
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5_000
  server.maxHeadersCount = 100
  server.maxRequestsPerSocket = 1_000
  app.flushLogs()
}

function parseTrustProxyHops(value: string | undefined): number {
  const parsed = Number(value ?? '0')
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10 ? parsed : 0
}

void bootstrap()
