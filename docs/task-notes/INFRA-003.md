# INFRA-003 对象存储：KYC/产品文件/工单附件

状态：待审核（生产安全状态机与单元验证已完成；真实 S3/KMS/扫描器和 PostgreSQL 迁移演练待外部环境）
完成日期：2026-07-12

## 范围
S3 兼容对象存储抽象层：预签名上传/下载、对象元数据落盘、完整性校验、临时访问控制、保留策略/病毒扫描存根。

## 新增内容（独立模块 `src/object-storage/`，仅动 `app.module.ts` 一行注册）
- 迁移 `1783778000000-create-object-storage.ts`：
  - `object_storage_objects`（bucket, key 唯一；content_type, size_bytes, checksum_md5, tags, uploaded_by, uploaded_at）
  - `presigned_urls`（object_id 关联，method PUT/GET, expires_at, created_by, created_at, used_at）
  - 索引：bucket+key 唯一、presigned 过期未用索引
- `object-storage.entities.ts` / `object-storage.errors.ts`（本地错误码）
- `object-storage.service.ts`：
  - `createUploadPresignedUrl()`：生成 PUT 预签名 URL（默认 15min），预创建对象记录 pending
  - `createDownloadPresignedUrl()`：生成 GET 预签名 URL，校验对象存在
  - `completeUpload(presignedId, sizeBytes, md5?)`：客户端上传完成回调，HEAD S3 验证 size/ETag，补全元数据，标记 presigned used
  - `deleteObject()`：软删（移除 S3 + 删除元数据 + 关联 presigned 标记 used）
  - `getObjectMeta()`：查询元数据
  - `cleanupExpiredPresigned()`：定时清理过期未用预签名
- `object-storage.controller.ts`（管理路由 `v1/storage/*` 受管理员会话和 `storage.manage` 权限保护；扫描回调使用独立 HMAC）
- `object-storage.module.ts`

## 端点
- `POST v1/storage/presigned/upload` 创建上传预签名 URL
- `POST v1/storage/presigned/download` 创建下载预签名 URL
- `POST v1/storage/presigned/complete` 完成上传回调
- `GET v1/storage/objects/meta?bucket=...&key=...` 查询对象元数据
- `GET v1/storage/objects/id/:objectId` 按对象 ID 查询管理元数据
- `DELETE v1/storage/objects` 以结构化 body 删除对象
- `POST v1/user-storage/attachments/presigned/upload|complete|download` 用户会话归属的工单附件流
- `GET v1/user-storage/attachments/:objectId/status` 查询本人附件扫描状态

## 验证
- `nest build` 通过（TypeScript 编译无误）
- 无数据库/S3 网络依赖的对象存储安全单测 8/8 通过；Core API 完整低内存回归 24 suites / 139 tests 与 1024MB 构建通过。
- 迁移静态契约通过：25 条迁移有序，新增迁移可逆；真实 PostgreSQL `run → revert → run` 与真实 S3/KMS/扫描器联调仍待环境。

## 设计备注
- 使用 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`，兼容 AWS S3、MinIO、Cloudflare R2 等
- 允许桶名单：`rwa-kyc`、`rwa-assets`、`rwa-attachments`（`ALLOWED_BUCKETS` 常量）
- 预签名 TTL 限制为 60-900s，并要求调用方按签名发送 Content-Type、Content-Length 和 SHA-256 checksum。
- 下载仅允许 `scan_status=clean` 且已完成的对象；`pending/quarantined/failed` 一律拒绝。
- 保留策略：未在 DB 层自动删除，留待 DB-007 统一保留/清理 job 处理
- 生产加固通过独立可逆迁移补齐原模型字段，不改动其他业务表。

## 2026-07-15 生产加固

- 新增 `1783792000000-harden-object-storage.ts`，修复旧实体要求 `presigned_urls.bucket/key` 但原迁移未建列的问题，并加入预期大小、SHA-256、扫描状态、扫描供应商/引用、扫描事件去重与待扫描索引。
- 上传按桶限制 MIME、扩展名和大小，拒绝路径遍历/控制字符与重复 key；服务端 `HEAD` 比对实际大小、Content-Type 和可用的 SHA-256。
- 扫描回调 `POST /v1/storage/callbacks/scan` 使用五分钟时间窗和 HMAC-SHA256；事件幂等，结果以数据库条件更新写入，避免并发覆盖。
- 扫描器声称 `clean` 时仍必须提交其计算的 SHA-256；不一致对象自动进入 `quarantined`，不会生成下载 URL。
- 修复过期清理条件：只选择 `expires_at < now()` 的未使用 URL，而非尚未过期的 URL。
- `OBJECT_STORAGE_ENABLED=false` 时所有存储操作以 503 安全关闭；生产启用时必须具备 KMS Key、正式扫描器、回调密钥以及 workload/static 明确认证模式。
- 用户工单附件键由服务端生成并绑定会话用户；工单层只持久化经过归属与 `clean` 校验的对象 UUID。
