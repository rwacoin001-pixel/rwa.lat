# INFRA-004 日志、指标、链路追踪、报警

状态：已完成（nest build 通过，核心模块就绪；Prometheus / OpenTelemetry / 告警模块完成）
完成日期：2026-07-12

## 范围
全栈可观测性基座：结构化日志、Prometheus 指标、OpenTelemetry 分布式追踪、阈值告警与邮件通知。复用现有 NestJS 架构，不引入外部重型平台（Grafana/Jaeger 等可后接）。

## 新增内容（独立模块 `src/observability/`，仅动 `app.module.ts` 一行注册）
- `observability.module.ts`：聚合 Logging / Metrics / Tracing / Alerting
- `metrics.service.ts`：使用独立 Registry 的 Prometheus 计数器/直方图/仪表盘（HTTP/DB/钱包/KYC/赎回/合作伙伴回调/订单/结算等业务指标）
- `metrics.controller.ts`：`GET /v1/metrics` 通过 Bearer 鉴权后提供 Prometheus 抓取；健康检查由独立 `HealthModule` 提供
- `tracing/`：
  - `tracing.service.ts`：OpenTelemetry NodeTracerProvider + Jaeger/OTLP 导出器 + HTTP/Express/Pg 自动插桩
  - 方法：`runWithSpan()`、`startSpan()`、`injectContext()`、`extractContext()`
- `alerting/`：
  - `alerting.service.ts`：规则引擎（阈值/操作符/冷却/严重级）、后台定时评估、邮件通知
  - `alerting.controller.ts`：`GET /v1/alerting/rules`、`GET /v1/alerting/alerts`、`POST /v1/alerting/alerts/:id/ack`、`POST /v1/alerting/rules/:name/fire`
- `logging/`：Winston JSON 格式化，控制台彩色输出，环境区分 debug/info

## 端点
- `GET /v1/metrics` → Prometheus 文本格式（生产环境必须提供 `METRICS_BEARER_TOKEN`）
- `GET /v1/health` / `GET /v1/health/ready` → 健康/就绪探针
- `GET /v1/alerting/rules` / `GET /v1/alerting/alerts` / `POST /v1/alerting/alerts/:id/ack` / `POST /v1/alerting/rules/:name/fire`

## 验证
- `nest build` 通过（TS 编译无误）
- 依赖：`nest-winston`、`prom-client`、`@opentelemetry/*`、`nodemailer`
- 无新表/迁移，纯应用层模块

## 设计备注
- 指标命名空间 `rwa_` 前缀，避免与 node_* 默认指标冲突
- 业务指标覆盖：HTTP、DB、钱包余额、KYC 提交/裁决、赎回请求/执行、Partner 回调、订单/成交/结算
- 追踪：2026-07-15 已升级到 OpenTelemetry SDK 0.220 与自动插桩 0.78；使用 `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` 输出到 OTLP Collector，再由 Collector 转发到 Jaeger 或其他后端。未配置端点时不启动 SDK。
- 告警：内存态规则 + 30s 定时评估 + 邮件发送（SMTP 配置可选），严重级 critical 发邮件
- 遵守 KISS/DRY/硬约束：无新表、无改动既有代码、仅一行模块注册

## 2026-07-15 生产加固

- `/v1/metrics` 改为导出应用实际使用的独立 Registry；修复旧模块只暴露全局默认指标、遗漏业务指标的问题。
- 生产环境必须提供 `METRICS_BEARER_TOKEN`，抓取请求使用 Bearer 认证并进行常量时间比较；响应禁止缓存。
- 删除未加载、无鉴权且会重复声明路由的旧指标模块，同时移除 `@willsoto/nestjs-prometheus` 依赖。
- API 增加单实例 IP 限流后备、明确的 `TRUST_PROXY_HOPS`、30 秒请求接收超时、15 秒请求头超时、5 秒 Keep-Alive、100 个请求头和每连接 1,000 次请求上限。
- 多实例统一限流、网关连接上限和 Prometheus 网络策略仍属于部署平台验收项；本地计数器不宣称提供分布式一致性。
