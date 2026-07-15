import type { Metadata, Viewport } from 'next'
import PwaRegister from '@/components/pwa-register'
import { designTokens } from '@/lib/design-tokens'
import './globals.css'

export const metadata: Metadata = {
  title: 'RWA.LAT — AI Investment OS',
  description: 'A premium USDT-first investment experience for AI Compute, RWA, global stocks and prediction markets.',
  applicationName: 'RWA.LAT',
  manifest: '/manifest.webmanifest',
  keywords: ['AI investment', 'digital assets', 'AI Compute', 'RWA', 'portfolio intelligence'],
  authors: [{ name: 'RWA.LAT' }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RWA.LAT',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/rwa-mark.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/rwa-mark-180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'RWA.LAT — Invest with intelligence.',
    description: 'One USDT wallet. Global opportunities. AI-guided decisions.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: designTokens.color.canvas,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-black">
      <body className="antialiased bg-black text-white overflow-x-hidden">
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
