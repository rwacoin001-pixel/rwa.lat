import type { Metadata } from 'next'
import TrustDesktopEntry from '@/components/desktop/TrustDesktopEntry'
import { BRAND } from '@/lib/brand/build-brand'

export const metadata: Metadata = {
  title: `${BRAND.name} — Desktop`,
  description: BRAND.id === 'areit' ? 'Desktop visitors continue to https://www.capitaland-ascendasreit.com/.' : 'Open the KIMENG platform on this website.',
}

export default function DesktopPage() {
  return <TrustDesktopEntry />
}
