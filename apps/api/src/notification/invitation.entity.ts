import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

@Entity({ schema: 'app', name: 'invitations' })
@Check(`"state" = 'accepted' = ("accepted_at" IS NOT NULL)`)
@Check(`"state" = 'revoked' = ("revoked_at" IS NOT NULL)`)
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  inviter_user_id!: string

  @Column({ type: 'varchar', nullable: true })
  email?: string

  @Column({ type: 'varchar' })
  role!: string

  @Index({ unique: true })
  @Column({ type: 'bytea' })
  token_hash!: Buffer

  @Column({ type: 'varchar', default: 'pending' })
  state!: 'pending' | 'accepted' | 'revoked' | 'expired'

  @Column({ type: 'uuid', nullable: true })
  accepted_user_id?: string

  @Column({ type: 'timestamptz' })
  expires_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at?: Date

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at?: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
