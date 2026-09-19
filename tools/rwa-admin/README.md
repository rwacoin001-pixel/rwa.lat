# rwa-admin — RWA.LAT 运营工具集（v1 · 只读）

给运营/巡检/日报提供统一入口。也是"手机控制后端"（服务器微信助手）的**前置工具层**。

## 用法

```bash
python rwa-admin.py status        # 服务健康探测（核心API/管理API/站点）
python rwa-admin.py stats         # 核心运营统计（用户/KYC/组合/社区/工单/资产/同步）
python rwa-admin.py users [N]     # 最近注册用户（默认 10）
python rwa-admin.py queue         # 社区内容审核队列
python rwa-admin.py sync          # 数据同步历史与覆盖度
python rwa-admin.py report        # 生成中文日报文本
python rwa-admin.py report --send # 生成日报并推送微信（hermes send）
```

## 依赖与安全

- `psycopg2`：连接生产库，**只读会话**（`set_session(readonly=True)`，工具层不写库）
- `rwa_secrets.py`（DPAPI 金库助手）：从 `Desktop/rwa/rwa-secrets.dpapi.txt` 读取
  `PRODUCTION_DATABASE_URL`；路径可用环境变量 `RWA_SECRETS_HELPER` 覆盖
- **密钥全程不回显**

## 服务器迁移（微信助手计划）

1. 拷贝本目录 + `rwa_secrets.py` 到服务器
2. `pip install psycopg2-binary`，设 `RWA_SECRETS_HELPER` 指向脚本目录
3. 服务器 Hermes 的 `hermes send --to weixin` 可用后，`report --send` 直接工作

## 定时任务

本机 Hermes cron：每日 09:00 运行 `rwa-daily-report.sh`（→ `report --send`）。
服务器迁移后改为服务器 systemd timer 或 Hermes cron。

## 规划（v2）

- 写操作（社区审核通过/拒绝、通知发送）经 admin API（需管理员会话）
- 快慢分流：常用查询走"直达命令"（秒回），复杂任务异步回报
