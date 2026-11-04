import type { ArtStyle, PosterCategory, PosterLayout } from './referral-poster'

/* Per-artwork layout (fractions of the 1086×1448 artwork): where the headline sits, its colour and type,
   and where the subject is (the renderer refuses to put text over it). Designed together with each image
   (generated from D:/rwa-lat-builds/poster-styles/layouts.json by scripts/gen-layouts.py). */
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
type Entry = { file: string; category: PosterCategory; layout: PosterLayout }
export const artLayouts: Record<ArtStyle, Entry> = {
  inkAutumn: { file: 'ink-autumn', category: 'ink', layout: { text: box(0.08, 0.14, 0.73, 0.2), subject: box(0.34, 0.345, 0.56, 0.46), align: 'start', vertical: false, ink: 'ink', font: 'serif', scrim: 'none', footer: 'light', top: 'light' } },
  inkCloud: { file: 'ink-cloud', category: 'ink', layout: { text: box(0.54, 0.29, 0.4, 0.3), subject: box(0.015, 0.205, 0.515, 0.525), align: 'start', vertical: true, ink: 'paper', font: 'serif', scrim: 'none', footer: 'dark', top: 'dark' } },
  inkJade: { file: 'ink-jade', category: 'ink', layout: { text: box(0.08, 0.6, 0.84, 0.2), subject: box(0.47, 0.21, 0.445, 0.38), align: 'center', vertical: false, ink: 'paper', font: 'serif', scrim: 'none', footer: 'dark', top: 'dark' } },
  vangoghStarry: { file: 'vangogh-starry', category: 'vangogh', layout: { text: box(0.09, 0.15, 0.75, 0.21), subject: box(0.015, 0.415, 0.97, 0.385), align: 'start', vertical: false, ink: 'paper', font: 'serif', scrim: 'none', footer: 'dark', top: 'dark' } },
  vangoghWheat: { file: 'vangogh-wheat', category: 'vangogh', layout: { text: box(0.54, 0.19, 0.4, 0.3), subject: box(0.07, 0.325, 0.445, 0.435), align: 'start', vertical: false, ink: 'ink', font: 'serif', scrim: 'none', footer: 'light', top: 'light' } },
  vangoghCypress: { file: 'vangogh-cypress', category: 'vangogh', layout: { text: box(0.08, 0.6, 0.84, 0.2), subject: box(0.07, 0.21, 0.86, 0.39), align: 'start', vertical: false, ink: 'paper', font: 'serif', scrim: 'none', footer: 'dark', top: 'dark' } },
  bauhausArch: { file: 'bauhaus-arch', category: 'bauhaus', layout: { text: box(0.07, 0.245, 0.4, 0.29), subject: box(0.5, 0.21, 0.45, 0.56), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'none', footer: 'light', top: 'light' } },
  bauhausSun: { file: 'bauhaus-sun', category: 'bauhaus', layout: { text: box(0.09, 0.59, 0.82, 0.21), subject: box(0.07, 0.17, 0.86, 0.395), align: 'center', vertical: false, ink: 'ink', font: 'sans', scrim: 'none', footer: 'light', top: 'light' } },
  bauhausNight: { file: 'bauhaus-night', category: 'bauhaus', layout: { text: box(0.54, 0.2, 0.4, 0.29), subject: box(0.075, 0.265, 0.46, 0.51), align: 'end', vertical: false, ink: 'paper', font: 'sans', scrim: 'none', footer: 'dark', top: 'dark' } },
  cyberStreet: { file: 'cyber-street', category: 'cyber', layout: { text: box(0.08, 0.15, 0.72, 0.23), subject: box(0.4, 0.4, 0.44, 0.355), align: 'start', vertical: false, ink: 'paper', font: 'sans', scrim: 'none', footer: 'dark', top: 'dark' } },
  cyberSkyline: { file: 'cyber-skyline', category: 'cyber', layout: { text: box(0.54, 0.22, 0.4, 0.31), subject: box(0.07, 0.195, 0.435, 0.515), align: 'start', vertical: false, ink: 'paper', font: 'sans', scrim: 'none', footer: 'dark', top: 'dark' } },
  cyberGate: { file: 'cyber-gate', category: 'cyber', layout: { text: box(0.07, 0.28, 0.4, 0.3), subject: box(0.48, 0.255, 0.46, 0.505), align: 'start', vertical: false, ink: 'paper', font: 'sans', scrim: 'none', footer: 'dark', top: 'dark' } },
}
