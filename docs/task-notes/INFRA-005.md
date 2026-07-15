# INFRA-005 构建与交付验证备注

状态：进行中（代码与本地门禁完成；远程 CI/部署环境待接入）  
更新：2026-07-15

## DESIGN.md 阅读记录

- 已阅读根目录 `DESIGN.md`、任务板完成定义和生产输入清单。
- 本任务只建立构建、测试、迁移与供应链门禁，不在缺少云账号、Secret 和审批规则时伪造部署成功。

## 已实现

- `.github/workflows/ci.yml`：
  - Core API 类型检查、103 项低内存单测和 1GB 限额构建。
  - PostgreSQL 16 迁移 `run -> revert -> run`、13 个低内存数据库套件、Admin API 测试/构建。
  - H5、Admin Frontend 和共享 API Client 生产构建。
  - 高危/严重生产依赖阻断和 CycloneDX SBOM 产物（保留 30 天）。
- `.github/workflows/dependency-review.yml`：PR 新增高危运行时依赖阻断。
- `.github/dependabot.yml`：npm 与 GitHub Actions 每周更新。
- `verify-migration-contract.mjs`：24 个迁移的时间戳、顺序和 `up/down` 合约门禁。
- `verify-migration-rehearsal.mjs`：只允许 `_test` 数据库，自动验证最新迁移回滚/重放。
- `test-unit-low-memory.mjs` / `test-database-low-memory.mjs`：为本机内存不足场景分进程、串行执行。
- Demo seed 策略：`staging/production` 明确跳过演示用户、产品和修复数据；开发、测试、Demo 保持可用。
- `docs/operations/Release-and-Rollback-Runbook.md`：分支门禁、环境晋级、回滚决策和资金异常停机流程。

## 安全修复与本地验证

- Nodemailer 升级到 9.0.3；OpenTelemetry 升级到 SDK 0.220/自动插桩 0.78，并改用官方 OTLP HTTP 导出。
- `pnpm audit --prod --audit-level high`：高危/严重项为 0；剩余 1 个中危项，不触发当前高危门禁。
- 20 个无数据库套件、103 项测试通过。
- API TypeScript 类型检查、低内存生产构建通过。
- 三个 GitHub YAML 文件已完成本地解析校验；迁移合约检查通过。

## 尚待外部完成

- 首次 GitHub Actions 远程运行及分支保护“必需检查”配置。
- `TEST_DATABASE_URL`/PostgreSQL 环境恢复后执行迁移回滚和 13 个数据库套件。
- 托管平台、镜像仓库、OIDC/IAM、预览/测试/生产环境、审批人和部署 Secret。
- 生产数据库迁移身份、备份点、维护窗口及灾备演练。以上完成前状态保持“进行中”。
