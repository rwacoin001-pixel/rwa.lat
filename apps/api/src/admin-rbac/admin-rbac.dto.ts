import { IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export class ListApprovalsQueryDto {
  @IsOptional() state?: 'requested' | 'approved' | 'rejected'
  @IsOptional() @Min(1) @Max(200) @IsString() limit?: string
}

export class CreateApprovalDto {
  @IsString() action!: string
  @IsString() objectType!: string
  @IsOptional() @IsString() objectId?: string
  @IsOptional() payload?: Record<string, unknown>
}

export class DecideApprovalDto {
  @IsOptional() @IsString() reasonCode?: string
}

export class AuditExportQueryDto {
  @IsOptional() @IsString() actorType?: string
  @IsOptional() @IsUUID() userId?: string
  @IsOptional() @IsString() action?: string
  @IsOptional() @IsString() from?: string
  @IsOptional() @IsString() to?: string
  @IsOptional() @Min(1) @Max(500) @IsString() limit?: string
}
