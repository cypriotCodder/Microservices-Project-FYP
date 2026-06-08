import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

if (process.env.OTEL_ENABLED === 'true') {
  const sdk = new NodeSDK({
    serviceName: process.env.SERVICE_NAME || 'auth-service',
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_URL || 'http://jaeger:4318/v1/traces'
    }),
    instrumentations: [getNodeAutoInstrumentations()]
  });
  sdk.start();
  console.log(`[OpenTelemetry] Tracing enabled for ${process.env.SERVICE_NAME || 'auth-service'}`);
} else {
  console.log(`[OpenTelemetry] Tracing disabled for ${process.env.SERVICE_NAME || 'auth-service'}`);
}
