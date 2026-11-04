import type { PosterCategory, PosterLayout } from './referral-poster'
import type { ART_STYLES_3 } from './referral-poster-art-3'

/* Movie-poster artworks, round 3 (1024×1536, full bleed): where the headline sits ON the picture, its colour, type and scrim,
   and the focal subject the text must never cover. Generated from D:/rwa-lat-builds/poster-styles-3/layouts.json (gen-layouts-3.py). */
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
type Entry = { file: string; category: PosterCategory; layout: PosterLayout }
export const artLayouts3: Partial<Record<typeof ART_STYLES_3[number], Entry>> = {
  filmInkGate: { file: 'film-ink-gate', category: 'ink', layout: { text: box(0.12, 0.12, 0.76, 0.2), subject: box(0.1, 0.33, 0.8, 0.53), align: 'center', vertical: false, ink: 'ink', font: 'serif', scrim: 'soft', footer: 'dark', top: 'light' } },
  filmInkFan: { file: 'film-ink-fan', category: 'ink', layout: { text: box(0.39, 0.12, 0.51, 0.21), subject: box(0.04, 0.35, 0.92, 0.43), align: 'end', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  filmInkNight: { file: 'film-ink-night', category: 'ink', layout: { text: box(0.12, 0.12, 0.66, 0.2), subject: box(0.21, 0.39, 0.67, 0.42), align: 'start', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  filmVangoghNight: { file: 'film-vangogh-night', category: 'painting', layout: { text: box(0.25, 0.1, 0.5, 0.18), subject: box(0.4, 0.3, 0.41, 0.43), align: 'center', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  filmVangoghField: { file: 'film-vangogh-field', category: 'painting', layout: { text: box(0.12, 0.15, 0.52, 0.21), subject: box(0.22, 0.39, 0.51, 0.29), align: 'start', vertical: false, ink: 'ink', font: 'serif', scrim: 'soft', footer: 'dark', top: 'light' } },
}
