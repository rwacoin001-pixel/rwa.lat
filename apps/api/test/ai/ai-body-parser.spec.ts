import { Body, Controller, Module, Post } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { installAiChatBodyParser } from '../../src/ai/ai-body-parser'
import { HttpExceptionFilter } from '../../src/common/http-exception.filter'

@Controller('v1')
class BodyProbeController {
  @Post('ai/chat') chat(@Body() body: { fixture: string }) { return { length: body.fixture.length } }
  @Post('orders') order(@Body() body: { fixture: string }) { return { length: body.fixture.length } }
}
@Module({ controllers: [BodyProbeController] })
class BodyProbeModule {}

describe('AI image request limits in the actual Nest middleware order', () => {
  let app: INestApplication, origin: string
  beforeAll(async () => {
    app = await NestFactory.create(BodyProbeModule, { logger: false })
    installAiChatBodyParser(app)
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.listen(0, '127.0.0.1')
    origin = await app.getUrl()
  })
  afterAll(async () => { await app?.close() })
  const send = (route: string, size: number) => fetch(`${origin}/v1/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fixture: 'a'.repeat(size) }) })
  it('accepts a bounded image payload above 100 KB for chat only', async () => {
    const response = await send('ai/chat', 1600000)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ length: 1600000 })
    expect((await send('orders', 150000)).status).toBe(413)
    const normal = await send('orders', 30)
    expect(normal.status).toBe(201)
    expect(await normal.json()).toEqual({ length: 30 })
  })
  it('rejects images over the dedicated 2 MB limit before the handler', async () => {
    expect((await send('ai/chat', 2100000)).status).toBe(413)
  })
  it('returns a controlled input error for malformed JSON with the production filter', async () => {
    const response = await fetch(`${origin}/v1/ai/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"private-fixture":' })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'REQUEST_JSON_INVALID' } })
  })
})
