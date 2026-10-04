import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { LANGUAGE_COOKIE, resolveInitialLocale } from '@/lib/locale-detection'
import { GeistMono } from 'geist/font/mono'
import PwaRegister from '@/components/pwa-register'
import { documentPreferencesBootstrap, themeColors } from '@/lib/document-preferences-bootstrap'
import { desktopRedirectBootstrap } from '@/lib/desktop-redirect'
import './globals.css'
import '../styles/ios.css'
import '../styles/material.css'
import '../styles/installed-app.css'
import PressFeedback from '@/components/press-feedback'
import { RwaThemeProvider } from '@/lib/rwa-theme'
import { I18nProvider } from '@/lib/i18n'
import PageChrome from '@/components/page-chrome'
import SessionPrivacyGate from '@/components/session-privacy-gate'
import AppStartup from '@/components/app-startup'

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
    icon: [
      { url: '/icons/rwa-pwa-v2-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/rwa-pwa-v2-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/rwa-mark.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/rwa-pwa-v2-apple-180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'RWA.LAT — Invest with intelligence.',
    description: 'One USDT wallet. Global opportunities. AI-guided decisions.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themeColors.light },
    { media: '(prefers-color-scheme: dark)', color: themeColors.dark },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [requestHeaders, requestCookies] = await Promise.all([headers(), cookies()])
  let country = requestHeaders.get('cf-ipcountry')
  try {
    const edgeCountry = getCloudflareContext().cf?.country
    if (typeof edgeCountry === 'string') country = edgeCountry
  } catch { /* Local Next.js and other hosts use the header or browser fallback. */ }
  const initialLocale = resolveInitialLocale({
    savedLocale: requestCookies.get(LANGUAGE_COOKIE)?.value,
    country,
    acceptLanguage: requestHeaders.get('accept-language'),
  })
  return (
    <html lang={initialLocale} dir={initialLocale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: desktopRedirectBootstrap }} />
        <script dangerouslySetInnerHTML={{ __html: documentPreferencesBootstrap }} />
      </head>
      <body className={`antialiased overflow-x-hidden ${GeistMono.variable}`}>
        <PwaRegister />
        <PressFeedback />
        <RwaThemeProvider><I18nProvider initialLocale={initialLocale}><PageChrome /><AppStartup /><SessionPrivacyGate>{children}</SessionPrivacyGate></I18nProvider></RwaThemeProvider>
      </body>
    </html>
  )
}
