/**
 * Whether the product asks accounts to complete identity verification (KYC) before they can act.
 *
 * Off by default: nobody is told to "verify your identity" and the home screen no longer treats an unverified
 * account as unfinished. Mirror of the API's KYC_REQUIRED_FOR_INVESTMENT: turn both on together, the API switch
 * decides what is allowed, this one decides what the screens nag about. Read at build time (NEXT_PUBLIC_*).
 *
 * The verification pages themselves stay reachable from Profile for anyone who wants to complete them.
 */
export const KYC_REQUIRED = process.env.NEXT_PUBLIC_KYC_REQUIRED === 'true'
