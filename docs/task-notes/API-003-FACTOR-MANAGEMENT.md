# API-003 安全因子管理补充

日期：2026-07-12

本轮新增：

- `GET /security/factors`：列出 TOTP 与 Passkey 状态，不返回 TOTP 密钥、公钥材料、挑战或恢复码散列。
- `DELETE /security/factors/totp/:factorId`：要求与当前用户和会话绑定的五分钟 step-up 凭证；撤销后清空未使用恢复码散列并写审计日志。
- `DELETE /security/passkeys/:passkeyId`：要求相同 step-up 凭证；软撤销 Passkey 并写审计日志。
- 新增单测覆盖安全因子列表、TOTP/Passkey 撤销、恢复码清理、审计记录与跨会话凭证拒绝。

验证：

- `npm run lint`：通过。
- `npm test -- --runInBand`：38 通过，11 跳过。
- `npm run build`：通过。

API-003 仍保持“进行中”：真实 PostgreSQL 迁移回滚和实际 PWA 域名 WebAuthn 验收仍受本机无 Docker/PostgreSQL 及生产域名配置限制。
