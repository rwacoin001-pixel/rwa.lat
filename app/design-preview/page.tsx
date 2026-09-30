import type { Metadata } from 'next'
import DesignPreview from '@/components/design-preview'

export const metadata: Metadata = {
  title: 'RWA.LAT — Wealth OS preview',
  description: 'Interactive product design preview for the RWA.LAT investment experience.',
}

export default function DesignPreviewPage() {
  return <DesignPreview />
}
