import { PATH_METADATA } from '@nestjs/common/constants'
import { AdminAuthController } from '../src/admin-auth.controller'
import { AdminController } from '../src/admin.controller'
import { ADMIN_API_PREFIX } from '../src/route-contract'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { AdminPermissionGuard, ADMIN_REQUIRED_PERMISSIONS } from '../src/admin-permission.guard'

describe('Admin API route contract', () => {
  it('owns the v1 prefix once and exposes the canonical admin controller paths', () => {
    expect(ADMIN_API_PREFIX).toBe('v1')
    expect(Reflect.getMetadata(PATH_METADATA, AdminController)).toBe('admin')
    expect(Reflect.getMetadata(PATH_METADATA, AdminAuthController)).toBe('admin/auth')
  })

  it('requires explicit read permissions on sensitive Admin endpoints', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toContain(AdminPermissionGuard)
    expect(Reflect.getMetadata(ADMIN_REQUIRED_PERMISSIONS, AdminController.prototype.listUsers)).toEqual(['users.read'])
    expect(Reflect.getMetadata(ADMIN_REQUIRED_PERMISSIONS, AdminController.prototype.listRedemptions)).toEqual(['redemptions.read'])
    expect(Reflect.getMetadata(ADMIN_REQUIRED_PERMISSIONS, AdminController.prototype.getRedemption)).toEqual(['redemptions.read'])
  })
})
