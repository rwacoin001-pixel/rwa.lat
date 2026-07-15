import { Injectable } from '@nestjs/common'
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'

@Injectable()
export class MetricsService {
  private readonly registry: Registry

  private readonly httpRequestsTotal: Counter
  private readonly httpRequestDuration: Histogram
  private readonly activeConnections: Gauge
  private readonly dbQueryDuration: Histogram
  private readonly dbQueryErrors: Counter
  private readonly walletBalanceOps: Counter
  private readonly walletBalanceErrors: Counter
  private readonly kycSubmissions: Counter
  private readonly kycDecisions: Counter
  private readonly redemptionRequests: Counter
  private readonly redemptionExecutions: Counter
  private readonly partnerCallbacksTotal: Counter
  private readonly partnerCallbackErrors: Counter
  private readonly orderCreated: Counter
  private readonly orderFilled: Counter
  private readonly settlementCompleted: Counter

  constructor() {
    this.registry = new Registry()
    collectDefaultMetrics({ register: this.registry, prefix: 'rwa_' })

    this.httpRequestsTotal = new Counter({
      name: 'rwa_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    })

    this.httpRequestDuration = new Histogram({
      name: 'rwa_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    })

    this.activeConnections = new Gauge({
      name: 'rwa_active_connections',
      help: 'Active WebSocket/HTTP connections',
      registers: [this.registry],
    })

    this.dbQueryDuration = new Histogram({
      name: 'rwa_db_query_duration_seconds',
      help: 'Database query duration',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    })

    this.dbQueryErrors = new Counter({
      name: 'rwa_db_query_errors_total',
      help: 'Database query errors',
      labelNames: ['query_type', 'table', 'error_code'],
      registers: [this.registry],
    })

    this.walletBalanceOps = new Counter({
      name: 'rwa_wallet_balance_operations_total',
      help: 'Wallet balance operations',
      labelNames: ['operation', 'asset', 'status'],
      registers: [this.registry],
    })

    this.walletBalanceErrors = new Counter({
      name: 'rwa_wallet_balance_errors_total',
      help: 'Wallet balance operation errors',
      labelNames: ['operation', 'asset', 'error_code'],
      registers: [this.registry],
    })

    this.kycSubmissions = new Counter({
      name: 'rwa_kyc_submissions_total',
      help: 'KYC submissions',
      labelNames: ['status'],
      registers: [this.registry],
    })

    this.kycDecisions = new Counter({
      name: 'rwa_kyc_decisions_total',
      help: 'KYC decisions',
      labelNames: ['decision', 'reason_code'],
      registers: [this.registry],
    })

    this.redemptionRequests = new Counter({
      name: 'rwa_redemption_requests_total',
      help: 'Redemption requests',
      labelNames: ['asset', 'status'],
      registers: [this.registry],
    })

    this.redemptionExecutions = new Counter({
      name: 'rwa_redemption_executions_total',
      help: 'Redemption executions',
      labelNames: ['asset', 'status'],
      registers: [this.registry],
    })

    this.partnerCallbacksTotal = new Counter({
      name: 'rwa_partner_callbacks_total',
      help: 'Partner callbacks received',
      labelNames: ['partner', 'event_type', 'status'],
      registers: [this.registry],
    })

    this.partnerCallbackErrors = new Counter({
      name: 'rwa_partner_callback_errors_total',
      help: 'Partner callback processing errors',
      labelNames: ['partner', 'event_type', 'error_code'],
      registers: [this.registry],
    })

    this.orderCreated = new Counter({
      name: 'rwa_orders_created_total',
      help: 'Orders created',
      labelNames: ['side', 'asset'],
      registers: [this.registry],
    })

    this.orderFilled = new Counter({
      name: 'rwa_orders_filled_total',
      help: 'Orders filled',
      labelNames: ['side', 'asset'],
      registers: [this.registry],
    })

    this.settlementCompleted = new Counter({
      name: 'rwa_settlements_completed_total',
      help: 'Settlements completed',
      labelNames: ['asset', 'status'],
      registers: [this.registry],
    })
  }

  getRegistry(): Registry {
    return this.registry
  }

  incHttpRequest(method: string, path: string, status: number): void {
    this.httpRequestsTotal.inc({ method, path, status: String(status) })
  }

  observeHttpDuration(method: string, path: string, seconds: number): void {
    this.httpRequestDuration.observe({ method, path }, seconds)
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count)
  }

  observeDbQuery(queryType: string, table: string, seconds: number): void {
    this.dbQueryDuration.observe({ query_type: queryType, table }, seconds)
  }

  incDbError(queryType: string, table: string, errorCode: string): void {
    this.dbQueryErrors.inc({ query_type: queryType, table, error_code: errorCode })
  }

  incWalletBalanceOp(operation: string, asset: string, status: string): void {
    this.walletBalanceOps.inc({ operation, asset, status })
  }

  incWalletBalanceError(operation: string, asset: string, errorCode: string): void {
    this.walletBalanceErrors.inc({ operation, asset, error_code: errorCode })
  }

  incKycSubmission(status: string): void {
    this.kycSubmissions.inc({ status })
  }

  incKycDecision(decision: string, reasonCode?: string): void {
    this.kycDecisions.inc({ decision, reason_code: reasonCode ?? 'none' })
  }

  incRedemptionRequest(asset: string, status: string): void {
    this.redemptionRequests.inc({ asset, status })
  }

  incRedemptionExecution(asset: string, status: string): void {
    this.redemptionExecutions.inc({ asset, status })
  }

  incPartnerCallback(partner: string, eventType: string, status: string): void {
    this.partnerCallbacksTotal.inc({ partner, event_type: eventType, status })
  }

  incPartnerCallbackError(partner: string, eventType: string, errorCode: string): void {
    this.partnerCallbackErrors.inc({ partner, event_type: eventType, error_code: errorCode })
  }

  incOrderCreated(side: string, asset: string): void {
    this.orderCreated.inc({ side, asset })
  }

  incOrderFilled(side: string, asset: string): void {
    this.orderFilled.inc({ side, asset })
  }

  incSettlementCompleted(asset: string, status: string): void {
    this.settlementCompleted.inc({ asset, status })
  }
}