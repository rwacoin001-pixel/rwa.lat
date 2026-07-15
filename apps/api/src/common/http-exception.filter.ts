import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const request = context.getRequest<Request>()
    const response = context.getResponse<Response>()
    const isHttpException = exception instanceof HttpException
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const exceptionResponse = isHttpException ? exception.getResponse() : undefined
    const message = typeof exceptionResponse === 'object' && exceptionResponse && 'message' in exceptionResponse
      ? (exceptionResponse as { message: unknown }).message
      : isHttpException ? exception.message : 'Internal server error'
    const code = typeof exceptionResponse === 'object' && exceptionResponse && 'code' in exceptionResponse
      ? (exceptionResponse as { code: unknown }).code
      : isHttpException ? exception.name : 'INTERNAL_SERVER_ERROR'

    if (!isHttpException) {
      const error = exception instanceof Error ? exception : new Error(String(exception))
      this.logger.error(`Unhandled request error: ${request.method} ${request.url}`, error.stack)
    }

    response.status(status).json({
      error: {
        code,
        message,
      },
      requestId: response.locals.requestId,
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
