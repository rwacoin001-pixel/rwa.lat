import { Injectable, LoggerService, Scope } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as winston from 'winston'

@Injectable({ scope: Scope.TRANSIENT })
export class LoggingService implements LoggerService {
  private readonly logger: winston.Logger
  private context?: string

  constructor(private readonly config: ConfigService) {
    this.logger = winston.createLogger({
      level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'rwa-lat-api' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ],
    })
  }

  setContext(context: string): void {
    this.context = context
  }

  log(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, { ...meta, context: this.context })
  }

  error(message: string, trace?: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, { ...meta, trace, context: this.context })
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, { ...meta, context: this.context })
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, { ...meta, context: this.context })
  }

  verbose(message: string, meta?: Record<string, unknown>): void {
    this.logger.verbose(message, { ...meta, context: this.context })
  }
}