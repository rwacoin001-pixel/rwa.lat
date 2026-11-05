/**
 * Per-level tint (2026-11-05 v3): the restrained colour of each gem's material, used where the gem is engraved (the
 * invitation card) or a level needs a quiet accent. Never a fill behind text.
 */
export const GEM_TINT: Record<number, string> = {
  1: '#6b7079', 2: '#8c96a3', 3: '#b08a4e', 4: '#7f8fa3', 5: '#6f93b8', 6: '#4a4f58', 7: '#a8823f',
}

export const gemLevel = (level: number) => Math.min(7, Math.max(1, Math.round(level || 1)))
