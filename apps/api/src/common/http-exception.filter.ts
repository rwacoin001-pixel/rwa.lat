import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const driver = (exception as {driverError?:{constraint?:string}} | null)?.driverError
    const normalized = driver?.constraint==='closed_account_financial_write'
      ? new HttpException({code:'ACCOUNT_CLOSED',message:'This account is closed. Contact support for manual resolution.'},HttpStatus.CONFLICT) : exception
    const context = host.switchToHttp()
    const request = context.getRequest<Request>()
    const response = context.getResponse<Response>()
    if (request.path?.startsWith('/v1/security/transaction-password') || request.path === '/v1/wallet/withdrawals' || request.path === '/v1/wallet/transfer-eligibility') {
      response.setHeader('Cache-Control', 'no-store')
    }
    const isHttpException = normalized instanceof HttpException
    const status = isHttpException ? normalized.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const exceptionResponse = isHttpException ? normalized.getResponse() : undefined
    const outer = typeof exceptionResponse === 'object' && exceptionResponse
      ? exceptionResponse as Record<string, unknown> : {}
    const payload = typeof outer.error === 'object' && outer.error
      ? outer.error as Record<string, unknown> : outer
    const message = payload.message ?? (isHttpException ? normalized.message : 'Internal server error')
    const code = payload.code ?? (isHttpException ? normalized.name : 'INTERNAL_SERVER_ERROR')
    if (status === 429 && (code === 'AUTH_EMAIL_CODE_RATE_LIMIT' || code === 'AUTH_PASSWORD_RATE_LIMIT')) {
      const retryAfter = (payload.details as { retryAfter?: unknown } | undefined)?.retryAfter
      if (typeof retryAfter === 'number' && Number.isSafeInteger(retryAfter) && retryAfter > 0 && retryAfter <= 3600) {
        response.setHeader('Retry-After', String(retryAfter))
      }
    }
    // Only public remediation data belongs in the response, never arbitrary exception metadata.
    const details = Object.fromEntries(
      ['requiredConsents', 'reasonCodes', 'decision', ...(typeof code === 'string' && code.startsWith('TRANSACTION_PIN_')
        ? ['remainingAttempts', 'lockedUntil', 'withdrawalBlockedUntil', 'serverTime'] : [])]
        .filter((key) => payload[key] !== undefined)
        .map((key) => [key, payload[key]]),
    )

    if (code === 'AUTH_FLOW_REQUIRED' && payload.authFlow) details.authFlow = payload.authFlow

    if (!isHttpException) {
      const error = exception instanceof Error ? exception : new Error(String(exception))
      this.logger.error(`Unhandled request error: ${request.method} ${request.url}`, error.stack)
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(Object.keys(details).length ? { details } : {}),
      },
      requestId: response.locals.requestId,
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
