import type { AuthenticatedAdmin } from './admin-session-auth.service'
import type { AdminRbacService } from './admin-rbac.service'

/** Only call after AdminSessionGuard: the gateway already checked its own RBAC.
 * The delegated ID is an audit subject, not a second core login identity.
 * Ordinary core sessions must still satisfy core RBAC, including disabled checks.
 */
export function assertAdminPermission(admin: AuthenticatedAdmin, rbac: AdminRbacService, permission: string): Promise<void> {
  const delegated = admin.roleId === 'service-channel'
    && admin.sessionId === `service:${admin.id}`
    && admin.permissions.includes('*')
  return delegated ? Promise.resolve() : rbac.assertPermission(admin.id, permission)
}
