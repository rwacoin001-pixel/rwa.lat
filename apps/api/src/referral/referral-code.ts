import { randomInt } from 'node:crypto'

/** No 0/O, 1/I/L: a code read off a poster or said aloud can't be mistyped. Stored lowercase, shown uppercase. */
export const SHORT_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const SHORT_CODE_LENGTH = 6
/** Every code ever issued (16-hex legacy, short, custom) keeps resolving; this is the accepted shape. */
export const REFERRAL_CODE_PATTERN = /^[a-z0-9]{6,16}$/
export const RESERVED_REFERRAL_CODES = new Set(['admin', 'signup', 'signin', 'system', 'support', 'referral'])
export const CUSTOM_REFERRAL_CODE_PATTERN = /^[areit0-9]{6}$/i
export const CUSTOM_REFERRAL_CODE_MESSAGE = 'Referral code must be exactly 6 characters using A, R, E, I, T and 0–9'
const LEGACY_CODE = /^[a-f0-9]{16}$/

export function generateShortCode(random: (max: number) => number = randomInt): string {
  let code: string
  do {
    code = ''
    for (let i = 0; i < SHORT_CODE_LENGTH; i++) code += SHORT_CODE_ALPHABET[random(SHORT_CODE_ALPHABET.length)]
  } while (RESERVED_REFERRAL_CODES.has(code))
  return code
}

/** Accepts what people type or paste: any case, spaces or dashes between groups. */
export function normalizeReferralCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 40) return null
  const code = input.replace(/[\s-]/g, '').toLowerCase()
  return REFERRAL_CODE_PATTERN.test(code) && !RESERVED_REFERRAL_CODES.has(code) ? code : null
}

/** A code the system generated before short codes; custom codes never match (they are user-chosen). */
export function isLegacyGeneratedCode(code: string): boolean { return LEGACY_CODE.test(code) }
