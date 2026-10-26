'use client'

/** Paper & Glass (palette A) is the only design now, on the server as on every device. Kept as a hook so call sites
    read the same; branches that tested it have been reduced to the palette A path. */
export const usePaletteA = () => true
