// Run inside the deployed admin container. Default is read-only; --apply repairs
// only an existing, active super_admin selected by its exact email address.
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

function requiredPermissions(root, mode) {
  const names = new Set()
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) scan(file)
      else if (entry.name.endsWith('.js')) {
        const source = fs.readFileSync(file, 'utf8')
        if (mode === 'admin') for (const match of source.matchAll(/RequireAdminPermissions\)\(([^)]*)\)/g)) {
          for (const name of match[1].matchAll(/['"]([^'"]+)['"]/g)) names.add(name[1])
        }
        else for (const match of source.matchAll(/assertPermission\([^,\n]+,\s*['"]([^'"]+)['"]/g)) names.add(match[1])
      }
    }
  }
  scan(root)
  if (!names.size) throw new Error(`No permission declarations found in ${mode}`)
  return [...names].sort()
}

function missingPermissions(profile, required) {
  if (!profile || profile.name !== 'super_admin' || profile.disabled_at) throw new Error('Expected one active super_admin; refusing to change account roles')
  return required.filter(permission => !(profile.permissions ?? []).includes(permission))
}

async function reconcile({ Client, email, required, apply }) {
  const results = []
  for (const key of ['ADMIN_DATABASE_URL', 'CORE_DATABASE_URL']) {
    if (!process.env[key]) throw new Error(`Missing ${key}`)
    const client = new Client({ connectionString: process.env[key] })
    await client.connect()
    try {
      await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY')
      const load = async () => {
        const { rows } = await client.query(`SELECT u.id,u.email,u.disabled_at,r.id AS role_id,r.name,
          COALESCE(array_agg(p.permission ORDER BY p.permission) FILTER(WHERE p.permission IS NOT NULL),'{}') AS permissions
          FROM app.admin_users u JOIN app.admin_roles r ON r.id=u.role_id
          LEFT JOIN app.admin_role_permissions p ON p.role_id=r.id
          WHERE lower(u.email)=lower($1) GROUP BY u.id,r.id`, [email])
        if (rows.length !== 1) throw new Error('Expected exactly one administrator account')
        return rows[0]
      }
      const before = await load(), missing = missingPermissions(before, required)
      if (apply && missing.length) {
        await client.query('SELECT id FROM app.admin_users WHERE id=$1 AND disabled_at IS NULL AND role_id=$2 FOR UPDATE', [before.id, before.role_id])
        await client.query(`INSERT INTO app.admin_role_permissions(role_id,permission)
          SELECT $1,permission FROM unnest($2::text[]) AS t(permission) ON CONFLICT DO NOTHING`, [before.role_id, missing])
        await client.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
          VALUES($1,'admin',$2,'admin.permissions.reconciled','admin_role',$3,$4,$5::jsonb)`,
        [randomUUID(),before.id,before.role_id,randomUUID(),JSON.stringify({ reason: 'Owner requested full permissions for existing super administrator', added: missing, before: before.permissions, source: 'deployed admin and API permission declarations' })])
      }
      const after = await load(), remaining = missingPermissions(after, required)
      if (apply && remaining.length) throw new Error(`Permissions still missing: ${remaining.join(', ')}`)
      await client.query(apply ? 'COMMIT' : 'ROLLBACK')
      results.push({ database: key, role: before.name, beforeCount: before.permissions.length, added: apply ? missing : [], missing: remaining, afterCount: after.permissions.length })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally { await client.end() }
  }
  return results
}

module.exports = { requiredPermissions, missingPermissions, reconcile }
if (require.main === module) {
  const email = process.argv.find(arg => arg.startsWith('--email='))?.slice(8)
  const extra = process.argv.find(arg => arg.startsWith('--api-permissions='))?.slice(18)
  if (!email || !extra) throw new Error('Require --email= and --api-permissions=JSON obtained from the deployed API')
  const required = [...new Set([...requiredPermissions('/workspace/apps/admin/dist', 'admin'), ...JSON.parse(extra)])].sort()
  if (required.some(permission => typeof permission !== 'string' || !/^[a-z][a-z._]+$/.test(permission))) throw new Error('Invalid permission declaration')
  const { Client } = require('/workspace/apps/admin/node_modules/pg')
  reconcile({ Client, email, required, apply: process.argv.includes('--apply') })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}
