import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'
import { DOCUMENT_KINDS, DocumentKind } from './document-model'
import { ApiProperty } from '@nestjs/swagger'
export class RevisionDto { @ApiProperty({minimum:1}) @IsInt() @Min(1) expectedRevision!: number }
export class CompanyDto extends RevisionDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) companyName!: string
  @ApiProperty() @IsString() @MaxLength(1000) registration!: string
  @ApiProperty() @IsString() @MaxLength(200) contact!: string
  @ApiProperty() @IsString() @MaxLength(300) website!: string
}
export class TemplateDto extends RevisionDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title!: string
  @ApiProperty() @IsString() @MaxLength(3000) introduction!: string
  @ApiProperty({type:[String],maxItems:60}) @IsArray() @ArrayMaxSize(60) @IsString({each:true}) @MaxLength(5000,{each:true}) terms!: string[]
  @ApiProperty() @IsBoolean() enabled!: boolean
}
export class StatementDocumentDto { @ApiProperty({example:'2025-08'}) @Matches(/^20\d\d-(0[1-9]|1[0-2])$/) month!: string }
export class AgreementConsentDto {
  @ApiProperty({minimum:1}) @IsInt() @Min(1) templateRevision!: number
  @ApiProperty({minimum:1}) @IsInt() @Min(1) companyRevision!: number
  @ApiProperty({type:Boolean,enum:[true]}) @IsIn([true]) accepted!: true
}
export class TaxRecordDto {
  @ApiProperty({format:'uuid'}) @IsUUID() idempotencyKey!: string
  @ApiProperty({format:'uuid'}) @IsUUID() userId!: string
  @ApiProperty({minimum:2000,maximum:2200}) @IsInt() @Min(2000) @Max(2200) taxYear!: number
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) accountHolder!: string
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) taxpayerId!: string
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) taxResidency!: string
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) jurisdiction!: string
  @ApiProperty() @IsString() @MaxLength(1000) taxpayerAddress!: string
  @ApiProperty({example:'USD'}) @Matches(/^[A-Z][A-Z0-9]{2,11}$/) currency!: string
  @ApiProperty({minimum:0,maximum:18}) @IsInt() @Min(0) @Max(18) decimals!: number
  @ApiProperty({type:String,description:'Nonnegative integer atomic amount in the original report currency and precision.'}) @Matches(/^\d{1,30}$/) grossAtomic!: string
  @ApiProperty({type:String}) @Matches(/^\d{1,30}$/) withheldAtomic!: string
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) incomeDescription!: string
  @ApiProperty() @IsString() @Matches(/^rwa-attachments\/[A-Za-z0-9_./-]+$/) evidenceRef!: string
  @ApiProperty({type:Boolean,enum:[true]}) @IsIn([true]) verified!: true
}
export class KindDto { @IsIn([...DOCUMENT_KINDS]) kind!: DocumentKind }
