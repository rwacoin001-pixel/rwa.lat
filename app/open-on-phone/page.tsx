import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import KimengDesktopInstall from '@/components/KimengDesktopInstall'
import { BRAND } from '@/lib/brand/build-brand'
import { isKimengPhone } from '@/lib/brand/phone-access.mjs'

export default async function OpenOnPhonePage() {
  if (BRAND.id !== 'kimeng') notFound()
  const request = await headers()
  if (isKimengPhone(request.get('user-agent') ?? '', request.get('sec-ch-ua-mobile') === '?1')) redirect('/home')
  return <KimengDesktopInstall />
}
