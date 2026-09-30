import { ApiProperty } from '@nestjs/swagger'

export class LegalSectionDto {
  @ApiProperty() title!: string
  @ApiProperty() body!: string
}
export class PublishedLegalDocumentDto {
  @ApiProperty({ enum: ['terms','privacy'] }) kind!: 'terms' | 'privacy'
  @ApiProperty() version!: string
  @ApiProperty() revision!: number
  @ApiProperty() title!: string
  @ApiProperty() effectiveDate!: string
  @ApiProperty({ type: [LegalSectionDto] }) sections!: LegalSectionDto[]
  @ApiProperty() publishedAt!: string
}
