# INFRA-002 Redis/任务队列/死信/回调消费

状态：已完成（单元 8/8 全绿，nest build 通过）
完成日期：2026-07-12

## 范围
基于现有 PostgreSQL 实现任务队列 + 死信 + 回调消费（不引入 BullMQ/ioredis，满足"无新依赖、KISS/DRY"约束），支持：
- 乱序并发领取（FOR UPDATE SKIP LOCKED）
- 幂等入队（dedup_key 去重）
- 指数退避重试 + 死信标记
- 外部回调落盘去重（partner+external_id 唯一索引）+ 消费派发
- 手工重放 dead-letter

## 新增内容（独立模块 `src/job-queue/`，仅动 `app.module.ts` 一行注册）
- 迁移 `1783774000000-create-job-queue.ts`：
  - `inbound_callback_events`（partner, event_type, external_id, payload, signature_ok, received_at, processed_at；partner+external_id 唯一）
  - `job_queue`（queue_name, payload, state[pending/running/completed/dead], attempts, max_attempts, last_error, dedup_key 唯一, run_at, created_at, completed_at）
  - 索引：claim 索引 `(queue_name, run_at) WHERE state='pending'` + 回调未处理索引
- `job-queue.entities.ts` / `job-queue.errors.ts`（本地错误码）
- `job-queue.service.ts`：
  - `enqueue()`：幂等入队
  - `claim(queue, limit, now)`：SKIP LOCKED 领取到期 pending，置 running
  - `ack/nack(jobId, error)`：完成 / 失败重试（退避）或死信
  - `replay(jobId)`：人工干预后重跑
  - `receiveCallback()`：回调落盘去重
  - `consumeCallbacks(handler)`：消费未处理回调，签名校验通过派发入队
- `job-queue.controller.ts`（路由 `v1/job-queue/*`，回调端点公开，队列管理端点由上层网关/守卫保护）
- `job-queue.module.ts`

## 端点
- `POST v1/job-queue/callbacks` 接收外部回调（去重、签名校验标记）
- `GET v1/job-queue/callbacks/unprocessed` 消费未处理回调
- `POST v1/job-queue/jobs` 入队
- `PUT v1/job-queue/jobs/:id/ack` 完成
- `PUT v1/job-queue/jobs/:id/nack` 失败（重试/死信）
- `PUT v1/job-queue/jobs/:id/replay` 重放死信
- `GET v1/job-queue/jobs/dead` 死信列表
- `GET v1/job-queue/jobs` 列表（可按 state 过滤）

## 验证
- 单元：`test/job-queue/job-queue.service.spec.ts`（8/8）— dedup、claim 乱序领取、run_at 过滤、ack/nack/死信、replay、回调去重、签名不通过不入队
- 隔离：`DROP SCHEMA app CASCADE` + `DROP TABLE public.schema_migrations` + `runMigrations`
- `nest build` 通过

## 备注
- 不依赖 Redis/BullMQ，复用现有 PG 连接，部署零新增基建。
- 死信通过 `state='dead'` 标记，不建单独表；告警侧可直接 `listDead()` 消费。
- 回调入口由服务端完成签名校验，不接受调用方声明的 `signatureOk`。

## 2026-07-15 生产安全更新

- 公共入口保留为 `POST /v1/job-queue/callbacks`，必须提供 `x-rwa-event-id`、`x-rwa-timestamp`（Unix 秒或毫秒）和 `x-rwa-signature`（`sha256=<hex>`）。
- 签名输入是 `{ eventId, eventType, partner, payload, timestamp }` 递归键排序后的确定性 JSON。服务端从 `PARTNER_CALLBACK_SECRETS_JSON` 选择密钥；每个密钥至少 32 个字符，并应存入部署平台 Secret Manager。
- 时间偏差窗口为五分钟；配置缺失、请求头缺失或格式错误、请求过期、签名错误均以 HTTP 401 安全拒绝。
- 队列运维端点迁移到 `/v1/admin/job-queue/*`，同时要求 `AdminSessionGuard` 和 `operations.jobs.manage`，不再假设上游网关会代为鉴权。
- `GET /v1/admin/job-queue/callbacks/unprocessed` 只读且不改变处理状态；持久化消费及确认应由 Worker 负责。
