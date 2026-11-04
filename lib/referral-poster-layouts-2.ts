import type { PosterCategory, PosterLayout } from './referral-poster'
import type { ART_STYLES_2 } from './referral-poster-art-2'

/* Movie-poster artworks, round 2 (1024×1536, full bleed): where the headline sits ON the picture, its colour, type and scrim,
   and the focal subject the text must never cover. Generated from D:/rwa-lat-builds/poster-styles-2/layouts.json (gen-layouts-2.py). */
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
type Entry = { file: string; category: PosterCategory; layout: PosterLayout }
export const artLayouts2: Record<typeof ART_STYLES_2[number], Entry> = {
  artHaipai: { file: 'art-haipai', category: 'ink', layout: { text: box(0.13, 0.14, 0.74, 0.19), subject: box(0.1, 0.35, 0.8, 0.46), align: 'start', vertical: false, ink: 'ink', font: 'serif', scrim: 'none', footer: 'dark', top: 'light' } },
  artNeoExpressionism: { file: 'art-neo-expressionism', category: 'painting', layout: { text: box(0.13, 0.19, 0.64, 0.2), subject: box(0.43, 0.4, 0.46, 0.43), align: 'start', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artColorField: { file: 'art-color-field', category: 'painting', layout: { text: box(0.15, 0.19, 0.7, 0.21), subject: box(0.3, 0.46, 0.44, 0.34), align: 'start', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artMinimalism: { file: 'art-minimalism', category: 'modern', layout: { text: box(0.12, 0.17, 0.74, 0.2), subject: box(0.29, 0.4, 0.54, 0.44), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'none', footer: 'light', top: 'light' } },
  artConstructivism: { file: 'art-constructivism', category: 'modern', layout: { text: box(0.13, 0.2, 0.67, 0.22), subject: box(0.13, 0.52, 0.71, 0.29), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  artDeconstructivism: { file: 'art-deconstructivism', category: 'modern', layout: { text: box(0.36, 0.18, 0.52, 0.22), subject: box(0.29, 0.55, 0.55, 0.29), align: 'end', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artNeoclassicism: { file: 'art-neoclassicism', category: 'modern', layout: { text: box(0.15, 0.19, 0.7, 0.19), subject: box(0.36, 0.4, 0.46, 0.44), align: 'center', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artNeoBrutalism: { file: 'art-neo-brutalism', category: 'modern', layout: { text: box(0.1, 0.42, 0.5, 0.21), subject: box(0.6, 0.14, 0.28, 0.64), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artNeoFuturism: { file: 'art-neo-futurism', category: 'future', layout: { text: box(0.16, 0.14, 0.68, 0.21), subject: box(0.1, 0.37, 0.8, 0.31), align: 'center', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artAtompunk: { file: 'art-atompunk', category: 'future', layout: { text: box(0.12, 0.16, 0.58, 0.21), subject: box(0.3, 0.39, 0.59, 0.35), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'light' } },
  artSolarpunk: { file: 'art-solarpunk', category: 'future', layout: { text: box(0.16, 0.15, 0.68, 0.21), subject: box(0.19, 0.38, 0.69, 0.44), align: 'center', vertical: false, ink: 'ink', font: 'serif', scrim: 'soft', footer: 'dark', top: 'light' } },
  artVaporwave: { file: 'art-vaporwave', category: 'future', layout: { text: box(0.15, 0.18, 0.7, 0.21), subject: box(0.33, 0.42, 0.45, 0.4), align: 'center', vertical: false, ink: 'ink', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artY2k: { file: 'art-y2k', category: 'future', layout: { text: box(0.15, 0.18, 0.7, 0.21), subject: box(0.11, 0.43, 0.75, 0.36), align: 'center', vertical: false, ink: 'ink', font: 'sans', scrim: 'none', footer: 'dark', top: 'dark' } },
  artSurrealism: { file: 'art-surrealism', category: 'dream', layout: { text: box(0.12, 0.18, 0.73, 0.21), subject: box(0.39, 0.39, 0.39, 0.37), align: 'start', vertical: false, ink: 'paper', font: 'serif', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artBiomorphic: { file: 'art-biomorphic', category: 'dream', layout: { text: box(0.14, 0.18, 0.69, 0.21), subject: box(0.19, 0.46, 0.64, 0.32), align: 'start', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artDreamcore: { file: 'art-dreamcore', category: 'dream', layout: { text: box(0.17, 0.23, 0.66, 0.21), subject: box(0.33, 0.51, 0.32, 0.25), align: 'center', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artDeco: { file: 'art-deco', category: 'graphic', layout: { text: box(0.17, 0.2, 0.66, 0.21), subject: box(0.27, 0.43, 0.63, 0.38), align: 'center', vertical: false, ink: 'ink', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artMemphis: { file: 'art-memphis', category: 'graphic', layout: { text: box(0.12, 0.13, 0.62, 0.2), subject: box(0.38, 0.38, 0.38, 0.43), align: 'start', vertical: false, ink: 'ink', font: 'sans', scrim: 'none', footer: 'light', top: 'light' } },
  artOp: { file: 'art-op', category: 'graphic', layout: { text: box(0.15, 0.25, 0.7, 0.18), subject: box(0.21, 0.49, 0.58, 0.35), align: 'center', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artGlitch: { file: 'art-glitch', category: 'graphic', layout: { text: box(0.12, 0.27, 0.75, 0.21), subject: box(0.29, 0.5, 0.53, 0.35), align: 'center', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
  artCollage: { file: 'art-collage', category: 'graphic', layout: { text: box(0.36, 0.22, 0.52, 0.18), subject: box(0.21, 0.4, 0.43, 0.4), align: 'end', vertical: false, ink: 'paper', font: 'sans', scrim: 'soft', footer: 'dark', top: 'dark' } },
}
