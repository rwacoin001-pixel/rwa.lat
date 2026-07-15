import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { trace, SpanStatusCode, Span, SpanOptions } from '@opentelemetry/api'
import { telemetrySdk } from '../instrumentation'

@Injectable()
export class TracingService implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await telemetrySdk?.shutdown()
  }

  getTracer(name: string) {
    return trace.getTracer(name)
  }

  startSpan(name: string, options?: SpanOptions): Span {
    const tracer = this.getTracer('rwa-lat')
    const span = tracer.startSpan(name, options)
    return span
  }

  async runWithSpan<T>(name: string, fn: (span: Span) => Promise<T>, attributes?: Record<string, unknown>): Promise<T> {
    const span = this.startSpan(name, { attributes: attributes as SpanOptions['attributes'] })
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) })
      span.recordException(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      span.end()
    }
  }
}
