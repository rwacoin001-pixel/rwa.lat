'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Bot, Download, Smartphone } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { ANDROID_APP } from '@/lib/android-app'
import { readSession, SESSION_CHANGED } from '@/lib/api/_http'
import { logout } from '@/lib/api/auth'
import styles from './kimeng-desktop-install.module.css'

const APPLE_GUIDE = 'https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iph42ab2f3a7/ios'
const copy = {
  zh: {
    title: '在手机上打开 金英',
    description: '添加到主屏幕。首次打开时，用原账户登录。',
    scan: '用手机相机扫码', signOut: '退出登录', apple: 'Apple 官方教程', download: '下载 金英 APK',
    ios: [
      ['用 Safari 打开', '用相机扫码，再在 Safari 中打开链接。'],
      ['添加到主屏幕', '点「分享」，选择「添加到主屏幕」。'],
      ['从主屏幕打开 金英', '如有「作为网页 App 打开」，请开启，再点「添加」。'],
    ],
    android: [
      ['在手机浏览器打开', '用相机扫码，再在手机浏览器打开链接。'],
      ['下载 金英 安装包', '点站内 Android 下载，打开已下载的 APK。'],
      ['按系统提示安装', '如系统要求授权，确认下载来源后，仅为当前浏览器授权。'],
    ],
  },
  en: {
    title: 'Open KIMENG on your phone',
    description: 'Add to Home Screen, then sign in with your existing account.',
    scan: 'Scan with your phone camera', signOut: 'Sign out', apple: 'Apple installation guide', download: 'Download KIMENG APK',
    ios: [
      ['Open in Safari', 'Scan the code with your camera and open the link in Safari.'],
      ['Add to Home Screen', 'Tap Share, then select Add to Home Screen.'],
      ['Open KIMENG from Home Screen', 'If offered, turn on Open as Web App, then tap Add.'],
    ],
    android: [
      ['Open in your mobile browser', 'Scan the code and open the link in your mobile browser.'],
      ['Download the KIMENG app', 'Choose the Android download, then open the downloaded APK.'],
      ['Follow the installation prompts', 'If prompted, verify the download source and grant permission only to that browser.'],
    ],
  },
}

export default function KimengDesktopInstall() {
  const { locale } = useI18n()
  const { theme } = useRwaTheme()
  const text = locale === 'zh-CN' ? copy.zh : copy.en
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios')
  const [signedIn, setSignedIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  useEffect(() => {
    const sync = () => setSignedIn(Boolean(readSession()))
    sync()
    window.addEventListener(SESSION_CHANGED, sync)
    return () => window.removeEventListener(SESSION_CHANGED, sync)
  }, [])

  async function signOut() {
    setSigningOut(true)
    try { await logout() } finally { window.location.replace('/login') }
  }

  return <main className={styles.page} data-theme={theme} aria-labelledby="kimeng-install-title" dir="ltr">
    <div className={styles.scene} aria-hidden="true" />
    <div className={styles.layout}>
      <a className={styles.logo} href="/login"><img src={`/brand/kimeng/logo-${theme === 'dark' ? 'dark' : 'light'}.svg`} width={129} height={40} alt="KIMENG" /></a>
      {signedIn && <button className={styles.signOut} type="button" onClick={() => void signOut()} disabled={signingOut}>{text.signOut}</button>}
      <div className={styles.card}>
        <div className={styles.scan}>
          <img className={styles.icon} src="/brand/kimeng/app-icon-96.png" width={44} height={44} alt="" />
          <div className={styles.qr}><img src="/desktop-auth/mobile-qr.png" alt={text.scan} width={164} height={164} /></div>
          <div className={styles.caption}><strong>{text.scan}</strong><span>kimengresearch.com</span></div>
        </div>
        <div className={styles.content}>
          <h1 id="kimeng-install-title">{text.title}</h1>
          <p>{text.description}</p>
          <div className={styles.platforms} role="group" aria-label={text.title}>
            <button type="button" aria-pressed={platform === 'ios'} onClick={() => setPlatform('ios')}><Smartphone size={15} />iPhone</button>
            <button type="button" aria-pressed={platform === 'android'} onClick={() => setPlatform('android')}><Bot size={15} />Android</button>
          </div>
          <ol className={styles.steps}>
            {text[platform].map(([label, description], index) => <li key={label}><span aria-hidden="true">0{index + 1}</span><div><b>{label}</b><small>{description}</small></div></li>)}
          </ol>
          <footer className={styles.footer}>
            {platform === 'ios' ? <a href={APPLE_GUIDE} target="_blank" rel="noopener noreferrer">{text.apple}<ArrowUpRight size={14} /></a>
              : ANDROID_APP.url && <a href={ANDROID_APP.url} target="_blank" rel="noopener noreferrer">{text.download}<Download size={14} /></a>}
          </footer>
        </div>
      </div>
    </div>
  </main>
}
