import type { PosterCategory, PosterLayout } from './referral-poster'
import type { ART_STYLES_5 } from './referral-poster-art-5'

/* Movie-poster artworks, round 5 (1024×1536, full bleed): where the headline sits ON the picture, its colour, type and scrim,
   and the focal subject the text must never cover. Generated from D:/rwa-lat-builds/poster-styles-5/layouts.json (gen-layouts-5.py). */
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
type Entry = { file: string; category: PosterCategory; layout: PosterLayout }
export const artLayouts5: Partial<Record<typeof ART_STYLES_5[number], Entry>> = {
  animeRainGate: { file: 'anime-rain-gate', category: 'anime', layout: { text: box(0.1, 0.16, 0.54, 0.2), subject: box(0.29, 0.405, 0.515, 0.36), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  animeSakuraGate: { file: 'anime-sakura-gate', category: 'anime', layout: { text: box(0.18, 0.205, 0.54, 0.19), subject: box(0.275, 0.45, 0.595, 0.39), align: 'center', vertical: false, ink: 'ink', font: 'serif', scrim: 'soft', footer: 'dark', top: 'light' } },
  animeSnowGate: { file: 'anime-snow-gate', category: 'anime', layout: { text: box(0.1, 0.285, 0.52, 0.2), subject: box(0.44, 0.505, 0.35, 0.23), align: 'start', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  animeRooftopGate: { file: 'anime-rooftop-gate', category: 'anime', layout: { text: box(0.3, 0.155, 0.55, 0.2), subject: box(0.1, 0.4, 0.355, 0.425), align: 'end', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  animeSeaGate: { file: 'anime-sea-gate', category: 'anime', layout: { text: box(0.12, 0.195, 0.51, 0.2), subject: box(0.485, 0.4, 0.415, 0.29), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  animeFestivalGate: { file: 'anime-festival-gate', category: 'anime', layout: { text: box(0.17, 0.255, 0.58, 0.18), subject: box(0.385, 0.455, 0.41, 0.325), align: 'center', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  memphisLounge: { file: 'memphis-lounge', category: 'graphic', layout: { text: box(0.12, 0.285, 0.58, 0.2), subject: box(0.535, 0.49, 0.29, 0.27), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  memphisStair: { file: 'memphis-stair', category: 'graphic', layout: { text: box(0.12, 0.18, 0.57, 0.2), subject: box(0.15, 0.39, 0.645, 0.445), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  memphisPool: { file: 'memphis-pool', category: 'graphic', layout: { text: box(0.13, 0.105, 0.6, 0.18), subject: box(0.405, 0.375, 0.38, 0.27), align: 'center', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  memphisKiosk: { file: 'memphis-kiosk', category: 'graphic', layout: { text: box(0.25, 0.13, 0.58, 0.18), subject: box(0.1, 0.325, 0.8, 0.51), align: 'end', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  memphisStillLife: { file: 'memphis-still-life', category: 'graphic', layout: { text: box(0.17, 0.625, 0.65, 0.18), subject: box(0.11, 0.14, 0.79, 0.445), align: 'center', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  memphisTerrace: { file: 'memphis-terrace', category: 'graphic', layout: { text: box(0.32, 0.15, 0.56, 0.2), subject: box(0.145, 0.39, 0.74, 0.43), align: 'end', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
}
