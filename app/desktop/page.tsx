import type { Metadata } from 'next'
import TrustDesktopEntry from '@/components/desktop/TrustDesktopEntry'

export const metadata: Metadata = {
  title: 'A-REIT — The Shape of Trust',
  description: 'Every age writes trust in its own hand. Explore the story of real-world assets, then continue with A-REIT on your phone.',
}

export default function DesktopPage() {
  return <TrustDesktopEntry />
}
