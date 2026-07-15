import { Module, Global } from '@nestjs/common'
import { WinstonModule } from 'nest-winston'
import { ConfigModule, ConfigService } from '@nestjs/config'
import * as winston from 'winston'
import { LoggingService } from './logging.service'

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production'
        return {
          level: isProd ? 'info' : 'debug',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
          transports: [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
              ),
            }),
          ],
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [LoggingService],
  exports: [LoggingService, WinstonModule],
})
export class LoggingModule {}