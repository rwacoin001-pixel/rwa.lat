import { Injectable, Logger, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { ActivityRecorderService, type ActivityHit } from './activity-recorder.service'
import { VisitLogService } from './visit-log.service'
import { authenticatedUserId, classifyDevice, clientCountry, extractClientIp, isTrackedRequest, refererPage, requestPathname, truncateUserAgent } from './visit-classifier'

/** Pure: the hit to record for a finished request, or null when it is not end-user app usage. */
export function activityFromRequest(request: Request, statusCode: number | null, now = new Date()): ActivityHit | null {
  const pathname = requestPathname(request.originalUrl || request.url)
  if (!pathname || !isTrackedRequest(request.method, pathname)) return null
  // Unknown routes are scanners or stale clients, not app usage.
  if (statusCode === 404) return null
  const userAgent = typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null
  const device = classifyDevice(userAgent)
  if (device === 'bot') return null
  const ip = extractClientIp({ ip: request.ip ?? request.socket?.remoteAddress, headers: request.headers })
  if (!ip) return null
  return {
    at: now,
    ip,
    // Set by SessionAuthGuard / OptionalSessionAuthGuard during the request; read after it finished.
    userId: authenticatedUserId((request as Request & { auth?: { userId?: unknown } }).auth?.userId),
    country: clientCountry(request.headers),
    device,
    userAgent: truncateUserAgent(userAgent ?? undefined),
    page: refererPage(request.headers.referer),
  }
}

/**
 * Counts end-user API requests into app.daily_activity and app.visit_log after the response finished.
 * Never throws and never awaits: the request only pays for a 'finish' listener.
 */
@Injectable()
export class ActivityTrackingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ActivityTrackingMiddleware.name)
  constructor(private readonly recorder: ActivityRecorderService, private readonly visits: VisitLogService) {}

  use(request: Request, response: Response, next: NextFunction) {
    if (this.recorder.enabled || this.visits.enabled) {
      const startedAt = new Date()
      response.once('finish', () => {
        try {
          const hit = activityFromRequest(request, response.statusCode, startedAt)
          if (hit && this.recorder.enabled) this.recorder.record(hit)
          if (hit && this.visits.enabled) this.visits.record(hit)
        } catch (error) {
          this.logger.debug(`activity skipped: ${error instanceof Error ? error.message : String(error)}`)
        }
      })
    }
    next()
  }
}
