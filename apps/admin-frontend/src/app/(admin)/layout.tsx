// This file marks the (admin) route group as protected
// All routes under (admin) require authentication via AdminLayout

import { AdminLayout } from '@/components/layout/AdminLayout'

// Use a more permissive type to avoid ReactNode conflicts
type ChildrenProp = {
  children: React.ReactNode
}

export default function AdminRouteGroupLayout({ children }: ChildrenProp) {
  return <AdminLayout>{children}</AdminLayout>
}