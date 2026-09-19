import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export class ListApprovalsQueryDto {
  @ApiPropertyOptional()
  @IsOptional() state?: 'requested' | 'approved' | 'rejected'
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number
}

export class CreateApprovalDto {
  @ApiPropertyOptional()
  @IsString() action!: string
  @IsString() objectType!: string
  @IsOptional() @IsString() objectId?: string
  @IsOptional() payload?: Record<string, unknown>
}

export class DecideApprovalDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() reasonCode?: string
}

export class AuditExportQueryDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() actorType?: string
  @IsOptional() @IsUUID() userId?: string
  @IsOptional() @IsString() action?: string
  @IsOptional() @IsString() from?: string
  @IsOptional() @IsString() to?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number
}
