// 通知本地错误码（不入侵 packages/contracts，守"不改现有代码"红线）
export const NOTIFICATION_ERROR_CODES = {
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  PREFERENCE_NOT_FOUND: 'PREFERENCE_NOT_FOUND',
} as const

export type NotificationErrorCode =
  (typeof NOTIFICATION_ERROR_CODES)[keyof typeof NOTIFICATION_ERROR_CODES]

export class NotificationError extends Error {
  constructor(
    public readonly code: NotificationErrorCode,
    message: string,
    public readonly httpStatus: number = 404,
  ) {
    super(message)
    this.name = 'NotificationError'
  }

  static notFound(id: string): NotificationError {
    return new NotificationError(
      NOTIFICATION_ERROR_CODES.NOTIFICATION_NOT_FOUND,
      `Notification ${id} not found`,
      404,
    )
  }

  static ticketNotFound(id: string): NotificationError {
    return new NotificationError(NOTIFICATION_ERROR_CODES.TICKET_NOT_FOUND, `Ticket ${id} not found`, 404)
  }

  static invitationNotFound(id: string): NotificationError {
    return new NotificationError(
      NOTIFICATION_ERROR_CODES.INVITATION_NOT_FOUND,
      `Invitation ${id} not found`,
      404,
    )
  }
}
