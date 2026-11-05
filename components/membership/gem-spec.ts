/**
 * The seven level gems (2026-11-05 v3, user: "the badge still is not right — 3D, like the faceted metal reference, with
 * motion"). One cut for all seven — a four-point star folded along each arm's ridge, so every arm shows a lit and a shaded
 * facet — and the material climbs: graphite → silver → champagne gold → platinum → ice crystal → black diamond →
 * black and gold. L7 adds a gold orbit.
 * Every gem is a compass star (2026-11-05): four long points in front, four short ones behind at 45° — never the lone
 * four-point "sparkle".
 * `tint` is the restrained colour used where the gem is engraved (the invitation card) or drawn flat.
 */
export type GemMaterial = {
  color: string
  metalness: number
  roughness: number
  clearcoat?: number
  iridescence?: number
  envMapIntensity?: number
}

export type GemSpec = {
  core: GemMaterial
  /** The short star behind (defaults to the core's material). */
  back?: GemMaterial
  /** The thin orbit ring's material; every hero shows one, L7's is gold. */
  ring: GemMaterial
  tint: string
}

const steel: GemMaterial = { color: '#d9dde3', metalness: 1, roughness: .32 }

export const GEMS: Record<number, GemSpec> = {
  1: { core: { color: '#6b717a', metalness: 1, roughness: .3 }, back: { color: '#4f545c', metalness: 1, roughness: .5 }, ring: steel, tint: '#6b7079' },
  2: { core: { color: '#cfd4db', metalness: 1, roughness: .18 }, back: { color: '#9aa1ab', metalness: 1, roughness: .34 }, ring: steel, tint: '#8c96a3' },
  3: { core: { color: '#e4c48e', metalness: 1, roughness: .17 }, back: { color: '#c19a5b', metalness: 1, roughness: .3 }, ring: { color: '#ead3ab', metalness: 1, roughness: .3 }, tint: '#b08a4e' },
  4: { core: { color: '#e9edf3', metalness: 1, roughness: .1 }, back: { color: '#c3cad4', metalness: 1, roughness: .3 }, ring: steel, tint: '#7f8fa3' },
  5: { core: { color: '#e6effa', metalness: .2, roughness: .04, clearcoat: 1, iridescence: .7, envMapIntensity: 1.7 }, back: { color: '#d4dde8', metalness: 1, roughness: .18 }, ring: steel, tint: '#6f93b8' },
  6: { core: { color: '#1b1d22', metalness: .9, roughness: .14, clearcoat: 1, envMapIntensity: 1.4 }, back: { color: '#aeb4bd', metalness: 1, roughness: .22 }, ring: steel, tint: '#4a4f58' },
  7: { core: { color: '#16171b', metalness: .9, roughness: .12, clearcoat: 1, envMapIntensity: 1.4 }, back: { color: '#d8b679', metalness: 1, roughness: .2 }, ring: { color: '#d8b679', metalness: 1, roughness: .22 }, tint: '#a8823f' },
}

export const gemLevel = (level: number) => Math.min(7, Math.max(1, Math.round(level || 1)))
