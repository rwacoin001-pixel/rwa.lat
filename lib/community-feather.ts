'use client'

/**
 * The community feather is gone (2026-11-02): composing is the morphing orb, see lib/compose-key.ts. Home
 * (components/screens/P04-HomeMaison.tsx) still reports its pinned feed here; that call does nothing now and can be
 * dropped with this file the next time the home screen is edited.
 */
export type FeatherState = { visible: boolean; faded: boolean }

export function setFeather(_next: FeatherState) {}
