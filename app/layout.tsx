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
import { launchSplashMarkup, launchSplashScript, launchSplashStyle } from '@/lib/launch-splash'
import { iosStartupImages } from '@/lib/ios-startup-images'
import IosInstallGate from '@/components/ios-install-gate'

export const metadata: Metadata = {
  title: 'A-REIT｜以智能科技提升投资体验',
  description: 'A-REIT 致力于带来更智能、高效、流畅的投资体验，让信息了解更清晰、决策过程更从容，陪伴你探索更多可能。机构资料介绍：CapitaLand Ascendas REIT（SGX: A17U）｜工业及商业地产投资。',
  applicationName: 'A-REIT',
  manifest: '/manifest.webmanifest',
  keywords: ['A-REIT', '投资体验', 'CapitaLand Ascendas REIT（SGX: A17U）', '工业及商业地产投资'],
  authors: [{ name: 'A-REIT' }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'A-REIT',
    // Shown by iOS from the tap until the page paints; same icon and position as the launch screen that follows.
    startupImage: iosStartupImages,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/a-reit-v1-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/a-reit-v1-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/brand/a-reit/app-icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/a-reit-v1-apple-180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'A-REIT｜以智能科技提升投资体验',
    description: 'A-REIT 致力于带来更智能、高效、流畅的投资体验，让信息了解更清晰、决策过程更从容，陪伴你探索更多可能。机构资料介绍：CapitaLand Ascendas REIT（SGX: A17U）｜工业及商业地产投资。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'A-REIT｜以智能科技提升投资体验',
    description: 'A-REIT 致力于带来更智能、高效、流畅的投资体验，让信息了解更清晰、决策过程更从容，陪伴你探索更多可能。机构资料介绍：CapitaLand Ascendas REIT（SGX: A17U）｜工业及商业地产投资。',
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
        <style dangerouslySetInnerHTML={{ __html: launchSplashStyle }} />
      </head>
      <body className={`antialiased overflow-x-hidden ${GeistMono.variable}`}>
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: launchSplashMarkup }} />
        <script dangerouslySetInnerHTML={{ __html: launchSplashScript }} />
        <PwaRegister />
        <PressFeedback />
        <RwaThemeProvider><I18nProvider initialLocale={initialLocale}><PageChrome /><IosInstallGate /><SessionPrivacyGate>{children}</SessionPrivacyGate></I18nProvider></RwaThemeProvider>
      </body>
    </html>
  )
}
