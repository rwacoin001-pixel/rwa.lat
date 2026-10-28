import { Body, Controller, Module, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { createHmac, randomBytes } from 'node:crypto'
import { installMailBodyParser } from '../../src/mail/mail-body-parser'
import { installAiChatBodyParser } from '../../src/ai/ai-body-parser'
import { InboundEmailGuard } from '../../src/mail/inbound-email.guard'
import { InboundMailDto } from '../../src/mail/mail.dto'
import { HttpExceptionFilter } from '../../src/common/http-exception.filter'

const secret = randomBytes(32).toString('hex')
@Controller('v1')
class Probe {
  @Post('internal/inbound-email') @UseGuards(InboundEmailGuard)
  receive(@Body() body: InboundMailDto, @Req() request: { rawBody: Buffer }) { return { length: body.text.length, bytes: request.rawBody.length } }
  @Post('ordinary') ordinary(@Body() body: { text: string }) { return body }
}
@Module({ imports: [ConfigModule.forRoot({ ignoreEnvFile: true, skipProcessEnv: true, load: [() => ({ INBOUND_EMAIL_SECRET: secret })] })], controllers: [Probe], providers: [InboundEmailGuard] })
class ProbeModule {}
describe('signed mail parser in actual Nest middleware order', () => {
  let app: INestApplication, origin: string
  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, { logger: false })
    installMailBodyParser(app)
    installAiChatBodyParser(app)
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.listen(0, '127.0.0.1')
    origin = await app.getUrl()
  })
  afterAll(async () => { await app?.close() })
  const payload = () => JSON.stringify({ messageId: '<message@example.com>', from: 'a@example.com', to: ['support@a-reit.com'], cc: [], subject: '客服', text: 'a'.repeat(150000), html: '', references: [], attachments: [] })
  const post = (body: string, signedBody = body, route = 'internal/inbound-email') => {
    const t = Math.floor(Date.now() / 1000)
    return fetch(`${origin}/v1/${route}`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Inbound-Signature': `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${signedBody}`).digest('hex')}` }, body })
  }
  it('accepts a signed body larger than the normal JSON limit and retains exact UTF-8 bytes', async () => {
    const body = payload(), response = await post(body)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ length: 150000, bytes: Buffer.byteLength(body) })
    expect((await post(body, body, 'ordinary')).status).toBe(413)
  })
  it('rejects tampered bytes, unknown identity fields, malformed JSON and oversized input', async () => {
    const body = payload()
    expect((await post(body + ' ', body)).status).toBe(401)
    expect((await post(JSON.stringify({ ...JSON.parse(body), userId: 'injected' }))).status).toBe(400)
    expect((await post('{"broken":')).status).toBe(400)
    expect((await post(JSON.stringify({ text: 'a'.repeat(16 * 1024 * 1024) }))).status).toBe(413)
  })
})
