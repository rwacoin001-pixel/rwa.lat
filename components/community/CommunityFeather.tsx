'use client'

import { Feather } from 'lucide-react'
import { useSyncExternalStore, type ReactNode } from 'react'
import { getFeather, openFeatherCompose, subscribeFeather } from '@/lib/community-feather'
import { useI18n } from '@/lib/i18n'
import { communityUiCopy } from '@/lib/maison-community-ui-copy'
import d from './community-feather.module.css'

/** The feather above the AI orb (2026-10-31). Wraps the orb; its state lives in lib/community-feather, the orb is unchanged. */
export function CommunityFeather({ children }: { children: ReactNode }) {
  const { locale } = useI18n()
  const feather = useSyncExternalStore(subscribeFeather, getFeather, getFeather)
  return <span className={d.anchor}>
    <button type="button" className={d.feather} data-visible={feather.visible || undefined} data-faded={feather.faded || undefined}
      aria-label={communityUiCopy[locale].compose} tabIndex={feather.visible ? 0 : -1} aria-hidden={!feather.visible} onClick={openFeatherCompose}>
      <Feather size={15} strokeWidth={2} aria-hidden="true" />
    </button>
    {children}
  </span>
}
