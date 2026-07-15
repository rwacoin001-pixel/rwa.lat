import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

export const ADMIN_RBAC_ERROR_CODES = {
  ROLE_NOT_FOUND: 'admin.role.not_found',
  ADMIN_USER_NOT_FOUND: 'admin.user.not_found',
  PERMISSION_DENIED: 'admin.permission.denied',
  APPROVAL_NOT_FOUND: 'admin.approval.not_found',
  APPROVAL_STATE_INVALID: 'admin.approval.state_invalid',
  SELF_APPROVAL_FORBIDDEN: 'admin.approval.self_forbidden',
} as const

export class AdminRbacError {
  static roleNotFound(id: string) {
    return new NotFoundException({ code: ADMIN_RBAC_ERROR_CODES.ROLE_NOT_FOUND, message: `Admin role ${id} not found` })
  }
  static adminUserNotFound(id: string) {
    return new NotFoundException({ code: ADMIN_RBAC_ERROR_CODES.ADMIN_USER_NOT_FOUND, message: `Admin user ${id} not found` })
  }
  static permissionDenied(permission: string) {
    return new ForbiddenException({ code: ADMIN_RBAC_ERROR_CODES.PERMISSION_DENIED, message: `Missing permission: ${permission}` })
  }
  static approvalNotFound(id: string) {
    return new NotFoundException({ code: ADMIN_RBAC_ERROR_CODES.APPROVAL_NOT_FOUND, message: `Approval request ${id} not found` })
  }
  static approvalStateInvalid(id: string, state: string) {
    return new BadRequestException({ code: ADMIN_RBAC_ERROR_CODES.APPROVAL_STATE_INVALID, message: `Approval ${id} is ${state}, cannot decide` })
  }
  static selfApprovalForbidden() {
    return new BadRequestException({ code: ADMIN_RBAC_ERROR_CODES.SELF_APPROVAL_FORBIDDEN, message: 'approved_by must differ from requested_by (four-eyes)' })
  }
}
