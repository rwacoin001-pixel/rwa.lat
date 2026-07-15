import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

const tracesConfigured = Boolean(
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
)

export const telemetrySdk = process.env.OTEL_SDK_DISABLED === 'true' || !tracesConfigured
  ? null
  : new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'rwa-lat-api',
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
      }),
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    })

telemetrySdk?.start()
