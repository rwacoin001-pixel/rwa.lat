import type { PosterCategory, PosterLayout } from './referral-poster'
import type { ART_STYLES_5 } from './referral-poster-art-5'

/* Movie-poster artworks, round 5 (1024×1536, full bleed): where the headline sits ON the picture, its colour, type and scrim,
   and the focal subject the text must never cover. Generated from D:/rwa-lat-builds/poster-styles-5/layouts.json (gen-layouts-5.py). */
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
type Entry = { file: string; category: PosterCategory; layout: PosterLayout }
export const artLayouts5: Partial<Record<typeof ART_STYLES_5[number], Entry>> = {

}
