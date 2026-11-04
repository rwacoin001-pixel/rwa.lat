import type { PosterCategory, PosterLayout } from './referral-poster'
import type { ART_STYLES_4 } from './referral-poster-art-4'

/* Movie-poster artworks, round 4 (1024×1536, full bleed): where the headline sits ON the picture, its colour, type and scrim,
   and the focal subject the text must never cover. Generated from D:/rwa-lat-builds/poster-styles-4/layouts.json (gen-layouts-4.py). */
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
type Entry = { file: string; category: PosterCategory; layout: PosterLayout }
export const artLayouts4: Partial<Record<typeof ART_STYLES_4[number], Entry>> = {
  filmDesertGate: { file: 'film-desert-gate', category: 'dream', layout: { text: box(0.14, 0.18, 0.7, 0.2), subject: box(0.135, 0.4, 0.76, 0.405), align: 'start', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  filmMirrorGate: { file: 'film-mirror-gate', category: 'dream', layout: { text: box(0.18, 0.2, 0.64, 0.22), subject: box(0.145, 0.46, 0.735, 0.396), align: 'center', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  filmGlassGate: { file: 'film-glass-gate', category: 'modern', layout: { text: box(0.11, 0.105, 0.62, 0.185), subject: box(0.272, 0.296, 0.53, 0.44), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  filmSketchGate: { file: 'film-sketch-gate', category: 'painting', layout: { text: box(0.33, 0.22, 0.55, 0.22), subject: box(0.195, 0.49, 0.68, 0.36), align: 'end', vertical: false, ink: 'ink', font: 'serif', scrim: 'none', footer: 'light', top: 'light' } },
  filmBlueprintGate: { file: 'film-blueprint-gate', category: 'modern', layout: { text: box(0.15, 0.17, 0.7, 0.22), subject: box(0.225, 0.605, 0.52, 0.235), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'none', footer: 'light', top: 'light' } },
  filmCloudGate: { file: 'film-cloud-gate', category: 'dream', layout: { text: box(0.13, 0.12, 0.7, 0.2), subject: box(0.405, 0.335, 0.435, 0.36), align: 'center', vertical: false, ink: 'ink', font: 'serif', scrim: 'soft', footer: 'dark', top: 'light' } },
  animeSkyGate: { file: 'anime-sky-gate', category: 'anime', layout: { text: box(0.1, 0.18, 0.5, 0.18), subject: box(0.15, 0.385, 0.735, 0.425), align: 'start', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  animeTwilightGate: { file: 'anime-twilight-gate', category: 'anime', layout: { text: box(0.18, 0.16, 0.62, 0.2), subject: box(0.265, 0.375, 0.575, 0.37), align: 'end', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  animeStarGate: { file: 'anime-star-gate', category: 'anime', layout: { text: box(0.12, 0.17, 0.53, 0.2), subject: box(0.535, 0.395, 0.27, 0.245), align: 'start', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
}
