import { SetMetadata } from '@nestjs/common'

export const ADMIN_PUBLIC = 'admin:public'
export const AdminPublic = () => SetMetadata(ADMIN_PUBLIC, true)
