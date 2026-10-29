'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { PATH_EVENT } from '@/lib/maison-nav'
import { closeProfile, dropProfile, syncProfileWithHistory, useProfileOverlay } from '@/lib/profile-overlay'
import styles from './profile-overlay.module.css'

const ProfileScreen = dynamic(() => import('../maison/AccountScreen').then((m) => ({ default: m.ProfileScreen })), { ssr: false })

/**
 * The personal centre over the current page (2026-10-29). The page below stays mounted, so dragging the panel toward
 * the trailing edge reveals it exactly as far as the finger goes; past a third (or a flick) the panel leaves.
 */
export function ProfileOverlay() {
  const open = useProfileOverlay()
  useEffect(() => {
    const onPop = () => syncProfileWithHistory()
    // Opening any page from inside the layer replaces it.
    const onPath = () => dropProfile()
    window.addEventListener('popstate', onPop)
    window.addEventListener(PATH_EVENT, onPath)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener(PATH_EVENT, onPath) }
  }, [])
  useEffect(() => {
    if (!open) return
    const root = document.documentElement, previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => { root.style.overflow = previous }
  }, [open])
  if (!open) return null
  return <div className={styles.layer} role="dialog" aria-modal="true">
    {/* ProfileScreen carries its own SwipePanel (slide in, follow the finger, leave). */}
    <ProfileScreen onClose={closeProfile} onSignedOut={() => { dropProfile(); window.location.assign('/login') }} />
  </div>
}
