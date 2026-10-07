import { IsUUID } from 'class-validator'
import { AuthFlowCompleteDto, AuthFlowEmailDto, AuthFlowTokenDto } from './password-auth.dto'

export class EmailBindingStartDto { @IsUUID() userId!: string }
export class EmailBindingSendDto extends AuthFlowEmailDto { @IsUUID() userId!: string }
export class EmailBindingTokenDto extends AuthFlowTokenDto { @IsUUID() userId!: string }
export class EmailBindingCompleteDto extends AuthFlowCompleteDto { @IsUUID() userId!: string }
