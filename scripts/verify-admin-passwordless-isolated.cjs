// Uses connection-local temporary tables only. The enclosing transaction is rolled back.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {Client}=require(path.join(root,'apps/admin/node_modules/pg'));
const {ConfigService}=require(path.join(root,'apps/admin/node_modules/@nestjs/config'));
const {AdminTotpService}=require(path.join(root,'apps/admin/dist/admin-totp.service'));
const {AdminAuthService,createAdminTotp,encryptAdminMfaSecret}=require(path.join(root,'apps/admin/dist/admin-auth.service'));
const env=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):{ADMIN_DATABASE_URL:process.env.TEST_DATABASE_URL};
if(!process.argv[2]){const url=new URL(env.ADMIN_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.match(url.pathname,/^\/rwa_lat_codex_.*_test$/)}
(async()=>{
 const client=new Client({connectionString:env.ADMIN_DATABASE_URL});await client.connect();
 try{
 await client.query('BEGIN');
 await client.query(`CREATE TEMP TABLE admin_users(id uuid PRIMARY KEY,email text,role_id uuid,password_hash text,disabled_at timestamptz,locked_until timestamptz,mfa_state text,mfa_secret_ciphertext text,mfa_last_counter bigint,failed_login_count int DEFAULT 0,last_login_at timestamptz);
 CREATE TEMP TABLE admin_roles(id uuid PRIMARY KEY,name text);
 CREATE TEMP TABLE admin_role_permissions(role_id uuid,permission text);
 CREATE TEMP TABLE admin_sessions(id uuid DEFAULT gen_random_uuid(),admin_user_id uuid,token_hash bytea,expires_at timestamptz,ip_address inet,user_agent text,revoked_at timestamptz,last_seen_at timestamptz);
 CREATE TEMP TABLE audit_logs(id uuid,actor_type text,actor_id uuid,action text,object_type text,object_id text,request_id uuid,metadata jsonb);`);
 const query=async(sql,params)=>{const safe=sql.replaceAll('app.','pg_temp.');assert.ok(!safe.includes('app.'));return(await client.query(safe,params)).rows};
 await query(fs.readFileSync(path.join(root,'deploy/migrations/admin-20261001-passwordless.sql'),'utf8').replace('CREATE TABLE IF NOT EXISTS','CREATE TEMP TABLE IF NOT EXISTS'));
 let n=0;const ds={query,transaction:async fn=>{const name='s'+(++n);await client.query('SAVEPOINT '+name);try{const v=await fn({query});await client.query('RELEASE SAVEPOINT '+name);return v}catch(e){await client.query('ROLLBACK TO SAVEPOINT '+name);throw e}}};
 const key=Buffer.alloc(32,31).toString('base64'),secret='JBSWY3DPEHPK3PXP',email='test-admin@example.invalid',uid='11111111-1111-1111-1111-111111111111',rid='22222222-2222-2222-2222-222222222222';
 const config=new ConfigService({ADMIN_LOGIN_MODE:'totp',ADMIN_MFA_ENCRYPTION_KEY:key,EMAIL_PROVIDER:'resend',EMAIL_FROM:'no-reply@example.invalid',RESEND_API_KEY:'test-not-a-real-key'});
 const totp=new AdminTotpService(ds,config),auth=new AdminAuthService(ds,config);const passed=[];
 await query('INSERT INTO app.admin_roles VALUES($1,$2)',[rid,'test-operator']);await query('INSERT INTO app.admin_role_permissions VALUES($1,$2)',[rid,'users.read']);
 await query("INSERT INTO app.admin_users(id,email,role_id,mfa_state,mfa_secret_ciphertext) VALUES($1,$2,$3,'enabled',$4)",[uid,email,rid,encryptAdminMfaSecret(secret,key)]);
 const session=await totp.login(email,createAdminTotp(secret),{});assert.deepEqual(session.admin.permissions,['users.read']);passed.push('bound TOTP login and permissions');
 await assert.rejects(()=>totp.login(email,createAdminTotp(secret),{}));passed.push('used TOTP rejected');
 await assert.rejects(()=>auth.login({email,password:'anything'}));passed.push('password entry disabled');
 let mailCode;let mailCount=0;const originalFetch=global.fetch;
 global.fetch=async(_url,options)=>{mailCount++;mailCode=JSON.parse(options.body).text.match(/验证码：(\d{6})/)[1];return {ok:true}};
 try{
 await totp.requestRecovery(email);await totp.requestRecovery(email);assert.equal(mailCount,1);passed.push('resend cooldown');
 for(let i=0;i<5;i++)await assert.rejects(()=>totp.verifyRecovery(email,String((Number(mailCode)+1)%1000000).padStart(6,'0')));
 await assert.rejects(()=>totp.verifyRecovery(email,mailCode));passed.push('email guess budget');
 await query("UPDATE app.admin_mfa_recovery SET created_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute'");
 await assert.rejects(()=>totp.verifyRecovery(email,mailCode));passed.push('expired email rejected');
 await totp.requestRecovery(email);const binding=await totp.verifyRecovery(email,mailCode);assert.ok(binding.otpauthUri.startsWith('otpauth://'));passed.push('verified email yields pending QR binding');
 await assert.rejects(()=>totp.verifyRecovery(email,mailCode));passed.push('email code single use');
 await assert.rejects(()=>totp.confirmRecovery('x'.repeat(43),createAdminTotp(binding.secret)));passed.push('invalid token rejected');
 await totp.confirmRecovery(binding.recoveryToken,createAdminTotp(binding.secret));passed.push('confirmed new factor');
 await assert.rejects(()=>totp.confirmRecovery(binding.recoveryToken,createAdminTotp(binding.secret)));passed.push('binding token single use');
 const rows=await query('SELECT revoked_at FROM app.admin_sessions WHERE admin_user_id=$1',[uid]);assert.ok(rows.every(r=>r.revoked_at));await assert.rejects(()=>auth.authenticate(session.sessionToken));passed.push('all old sessions revoked');
 await query('UPDATE app.admin_users SET mfa_last_counter=NULL WHERE id=$1',[uid]);await assert.rejects(()=>totp.login(email,createAdminTotp(secret),{}));passed.push('old factor rejected');
 const fresh=await totp.login(email,createAdminTotp(binding.secret),{});assert.equal(fresh.admin.id,uid);passed.push('new factor login preserves account');
 await query('UPDATE app.admin_users SET disabled_at=now() WHERE id=$1',[uid]);await assert.rejects(()=>totp.login(email,createAdminTotp(binding.secret),{}));passed.push('disabled account rejected');
 }finally{global.fetch=originalFetch}
 console.log(JSON.stringify({passed:passed.length,checks:passed,temporaryTablesOnly:true,productionRowsModified:false}));
 }finally{await client.query('ROLLBACK');await client.end()}
})().catch(e=>{console.error(e.message);process.exit(1)});
