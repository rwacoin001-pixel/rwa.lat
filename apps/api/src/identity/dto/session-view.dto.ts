import { ApiProperty } from '@nestjs/swagger'

/** S1: session-level auth view (GET /auth/session). */
export class SessionViewDto {
  @ApiProperty()
  userId!: string

  @ApiProperty()
  sessionId!: string

  @ApiProperty({ description: 'True when the email login identity is verified.' })
  emailVerified!: boolean

  @ApiProperty({ description: 'Server auth adapter mode (e.g. production, demo).' })
  authAdapter!: string

  @ApiProperty({ description: 'ISO timestamp when the session expires.' })
  expiresAt!: string

  @ApiProperty({ type: String, nullable: true, description: 'Masked sign-in label (a***@example.com or 0x12…abcd); null when unavailable.' })
  accountLabel!: string | null
}
