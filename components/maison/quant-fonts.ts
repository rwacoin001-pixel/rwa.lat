import { Cormorant_Garamond, Jost } from 'next/font/google'

/** Numerals and small caps for the Koala dial. Loaded with the Koala screen only. */
export const quantSerif = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-q-serif', display: 'swap' })
export const quantCaps = Jost({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-q-caps', display: 'swap' })
