import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DesignPreview from '@/components/design-preview'

export const metadata: Metadata = {
  title: 'A-REIT — Wealth OS preview',
  description: 'Interactive product design preview for the A-REIT investment experience.',
}

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <DesignPreview />
}
