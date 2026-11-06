import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { LANGUAGE_COOKIE, resolveInitialLocale } from '@/lib/locale-detection'
import { GeistMono } from 'geist/font/mono'
import PwaRegister from '@/components/pwa-register'
import { documentPreferencesBootstrap, paletteAColors } from '@/lib/document-preferences-bootstrap'
import { desktopRedirectBootstrap } from '@/lib/desktop-redirect'
import './globals.css'
import '../styles/ios.css'
import '../styles/material.css'
import '../styles/installed-app.css'
import '../styles/palette-a.css'
import '../styles/noto-sans-sc.css'
import PressFeedback from '@/components/press-feedback'
import { RwaThemeProvider } from '@/lib/rwa-theme'
import { I18nProvider } from '@/lib/i18n'
import PageChrome from '@/components/page-chrome'
import PaletteMedia from '@/components/palette-media'
import SessionPrivacyGate from '@/components/session-privacy-gate'
import { launchSplashMarkup, launchSplashScript, launchSplashStyle } from '@/lib/launch-splash'
import { iosStartupImages } from '@/lib/ios-startup-images'
import IosInstallGate from '@/components/ios-install-gate'
import KimengPhoneAccess from '@/components/KimengPhoneAccess'
import TransactionGlow from '@/components/TransactionGlow'
import { BRAND } from '@/lib/brand/build-brand'
import { isKimengPhone } from '@/lib/brand/phone-access.mjs'

const title = BRAND.id === 'areit' ? 'A-REIT｜以智能科技提升投资体验' : '金英 KIMENG｜让资产清晰起来'
const description = BRAND.id === 'areit' ? 'A-REIT 致力于带来更智能、高效、流畅的投资体验，让信息了解更清晰、决策过程更从容，陪伴你探索更多可能。机构资料介绍：CapitaLand Ascendas REIT（SGX: A17U）｜工业及商业地产投资。' : '让资产清晰起来。'

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.origin),
  ...(BRAND.noindex ? { robots: { index: false, follow: false } } : {}),
  title: BRAND.id === 'kimeng' ? BRAND.name : title,
  description,
  applicationName: BRAND.name,
  manifest: '/manifest.webmanifest',
  keywords: BRAND.id === 'areit' ? ['A-REIT', '投资体验', 'CapitaLand Ascendas REIT（SGX: A17U）', '工业及商业地产投资'] : ['金英', 'KIMENG', '投资体验'],
  authors: [{ name: BRAND.name }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.name,
    // Shown by iOS from the tap until the page paints; same icon and position as the launch screen that follows.
    startupImage: iosStartupImages,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: BRAND.icon192, sizes: '192x192', type: 'image/png' },
      { url: BRAND.icon512, sizes: '512x512', type: 'image/png' },
      { url: `${BRAND.assets}/app-icon.svg`, type: 'image/svg+xml' },
    ],
    apple: [{ url: BRAND.appleIcon, sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title,
    description,
    type: 'website',
    ...(BRAND.id === 'kimeng' ? { siteName: BRAND.name, images: [{ url: '/brand/kimeng/share-card.png', width: 1200, height: 630 }] } : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: paletteAColors.light },
    { media: '(prefers-color-scheme: dark)', color: paletteAColors.dark },
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
  const content = <SessionPrivacyGate>{children}</SessionPrivacyGate>
  const phone = isKimengPhone(requestHeaders.get('user-agent') ?? '', requestHeaders.get('sec-ch-ua-mobile') === '?1')
  return (
    <html data-brand={BRAND.id} lang={initialLocale} dir={initialLocale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
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
        <PaletteMedia />
        <RwaThemeProvider><I18nProvider initialLocale={initialLocale}>{BRAND.id === 'kimeng' && <TransactionGlow />}<PageChrome /><IosInstallGate />{BRAND.id === 'kimeng' ? <KimengPhoneAccess phone={phone}>{content}</KimengPhoneAccess> : content}</I18nProvider></RwaThemeProvider>
      </body>
    </html>
  )
}
