import type { Metadata } from 'next'
import TrustDesktopEntry from '@/components/desktop/TrustDesktopEntry'

export const metadata: Metadata = {
  title: 'A-REIT — Desktop',
  description: 'Desktop visitors continue to https://www.capitaland-ascendasreit.com/.',
}

export default function DesktopPage() {
  return <TrustDesktopEntry />
}
