import type { Metadata } from 'next'
import DesktopShowcase from '@/components/desktop/DesktopShowcase'

export const metadata: Metadata = {
  title: 'RWA.LAT — Made for your phone',
  description: 'RWA.LAT is a mobile investment app. Scan the code to open it on your phone.',
}

export default function DesktopPage() {
  return <DesktopShowcase />
}
