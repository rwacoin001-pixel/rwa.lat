'use client'

import type { ReactNode } from 'react'
import { MaisonPage } from './primitives'
import b from './bridge.module.css'

/**
 * Puts a pre-Maison screen (global `.screen` markup) on Maison paper: warm/navy ground, grain, ambient light,
 * and the legacy colour tokens re-pointed at the --m-* palette. Structure and behaviour stay untouched;
 * bridge.module.css only restyles the shared legacy vocabulary (hero, glass, fields, pills, CTA, states).
 */
export function MaisonBridge({ page, children }: { page: string; children: ReactNode }) {
  return <MaisonPage page={page}><div className={b.bridge} data-bridge-page={page}>{children}</div></MaisonPage>
}
