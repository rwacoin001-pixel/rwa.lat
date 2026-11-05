import localFont from 'next/font/local'

/** Numerals and small caps for the Koala dial. Loaded with the Koala screen only. */
export const quantSerif = localFont({ src: [{ path: '../../public/fonts/cormorantgaramond/CormorantGaramond[wght].ttf', weight: '500 600', style: 'normal' }, { path: '../../public/fonts/cormorantgaramond/CormorantGaramond-Italic[wght].ttf', weight: '500 600', style: 'italic' }], variable: '--font-q-serif', display: 'swap' })
export const quantCaps = localFont({ src: [{ path: '../../public/fonts/jost/Jost[wght].ttf', weight: '400 500', style: 'normal' }], variable: '--font-q-caps', display: 'swap' })
