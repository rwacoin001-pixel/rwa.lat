import { ApiProperty } from '@nestjs/swagger'
import { Matches } from 'class-validator'

// base64url, no padding: a SHA-256 challenge is 43 characters; verifiers and codes are long random strings.
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/
const SECRET = /^[A-Za-z0-9_-]{43,128}$/

/** The signed-in browser asks for a one-time code for the Android app, bound to the app's PKCE challenge. */
export class AppHandoffStartDto {
  @ApiProperty({ description: 'base64url(SHA-256(verifier)); the verifier never leaves the app' })
  @Matches(CHALLENGE)
  challenge!: string
}

/** The app redeems the code with the verifier only it holds. */
export class AppHandoffRedeemDto {
  @ApiProperty()
  @Matches(SECRET)
  code!: string

  @ApiProperty()
  @Matches(SECRET)
  verifier!: string
}
