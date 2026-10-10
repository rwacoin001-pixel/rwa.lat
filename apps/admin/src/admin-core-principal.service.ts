import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'
import type { AdminSessionActor } from './admin-auth.service'

/** Cross-database foreign-key identity only; authentication and RBAC stay in the admin database. */
@Injectable()
export class AdminCorePrincipalService implements OnModuleDestroy {
  private readonly core: Pool | null
  private readonly pending = new Map<string, Promise<void>>()

  constructor(config: ConfigService) {
    const url = config.get<string>('CORE_DATABASE_URL')?.trim()
    this.core = url ? new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 5000 }) : null
  }

  async onModuleDestroy() { await this.core?.end() }

  async ensure(actor: AdminSessionActor): Promise<void> {
    if (!this.core) return
    const current = this.pending.get(actor.id)
    if (current) return current
    const work = this.register(actor)
    this.pending.set(actor.id, work)
    try { await work } finally { if (this.pending.get(actor.id) === work) this.pending.delete(actor.id) }
  }

  private async register(actor: AdminSessionActor): Promise<void> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.id)) {
      throw new ServiceUnavailableException('Invalid control-plane administrator identity')
    }
    const client = await this.core!.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query('SELECT id FROM app.admin_users WHERE id=$1', [actor.id])
      if (!existing.rowCount) {
        const role = await client.query(`INSERT INTO app.admin_roles(name,description)
          VALUES ('control-plane-audit-only','Foreign-key identity for separately authenticated control-plane administrators; no login or permissions.')
          ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`)
        const inserted = await client.query(`INSERT INTO app.admin_users(id,email,role_id,disabled_at,password_hash,mfa_state)
          VALUES ($1,$2,$3,now(),NULL,'disabled') ON CONFLICT (id) DO NOTHING RETURNING id`,
          [actor.id, `audit-${actor.id}@control-plane.a-reit.com.invalid`, role.rows[0].id])
        if (inserted.rowCount) await client.query(`INSERT INTO app.audit_logs
          (actor_type,action,object_type,object_id,request_id,metadata)
          VALUES ('service','admin.control_plane.principal_registered','admin_principal',$1,gen_random_uuid()::text,$2::jsonb)`,
          [actor.id, JSON.stringify({ controlPlaneAdminId: actor.id, authenticationCopied: false, permissionsCopied: false })])
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }
}
