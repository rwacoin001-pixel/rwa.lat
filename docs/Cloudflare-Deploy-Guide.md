> **历史记录，不作为当前实施依据（标记于 2026-10-16）。** 以下正文保留原始名称、日期、决定及验收结论，不代表当前线上状态。实施与发布先读[当前项目说明](deployment-current.md)，界面设计以[当前设计规则](../DESIGN.md)为准。

# 橙云 (Cloudflare) 部署指南 — RWA.LAT

> 橙云 = Cloudflare（橙色 Logo）。免费方案即可部署。

## 架构概览

```
用户 → Cloudflare CDN → [H5 PWA (Workers) + Admin FE (Pages)]
                        ↓ API 代理
                   Core API (:4000) + Admin API (:4100)
                        ↓
                   PostgreSQL (Docker / 云数据库)
```

| 服务 | 部署到 | 免费额度 | 说明 |
|------|--------|---------|------|
| H5 PWA | Cloudflare Workers (OpenNext) | 100K 请求/天 | 已配 wrangler.jsonc + open-next.config.ts |
| Admin Frontend | Cloudflare Pages | 500 次 build/月, 无限请求 | Next.js 静态导出 |
| Core API | Docker (VPS/云服务器) | — | NestJS, 需要 PG 连接 |
| Admin API | Docker (VPS/云服务器) | — | NestJS, 需要 PG 连接 |
| PostgreSQL | Docker / Cloudflare D1 / 云 RDS | — | 共享数据库 |

> ⚠️ Cloudflare Workers 免费方案有 **25MB** 部署大小限制。H5 项目已配 OpenNext + standalone output。

---

## 第一部分：H5 PWA → Cloudflare Workers

### 步骤 1：安装依赖

```bash
cd D:\360MoveData\...\rwa.lat\rwa-lat
npm install @opennextjs/cloudflare wrangler --save-dev
```

### 步骤 2：登录 Cloudflare

```bash
npx wrangler login
```

浏览器会打开 Cloudflare 授权页面，点击允许。

### 步骤 3：构建

```bash
# 1. 先 build Next.js
npx next build

# 2. 再 build OpenNext (生成 .open-next/ 目录)
npx opennextjs-cloudflare build
```

> 如果本机内存不足报 ENOMEM，可以在服务器上或 WSL 里执行 build。

### 步骤 4：部署

```bash
npx wrangler deploy
```

部署成功后会输出 URL，如 `https://rwa-lat.<your-subdomain>.workers.dev`。

### 步骤 5：绑定自定义域名（可选）

```bash
# 在 Cloudflare Dashboard → Workers → rwa-lat → Settings → Domains
# 添加自定义域名如 h5.rwa.lat
```

或者修改 `wrangler.jsonc`：

```jsonc
{
  "routes": [
    { "pattern": "h5.rwa.lat/*", "custom_domain": true }
  ]
}
```

---

## 第二部分：Admin Frontend → Cloudflare Pages

### 步骤 1：构建

```bash
cd apps/admin-frontend
npx next build
```

### 步骤 2：部署到 Cloudflare Pages

方法 A — **Git 自动部署（推荐）**：

1. 去 Cloudflare Dashboard → Pages → Create a project → Connect to Git
2. 选择仓库 `wx6668888/rwa.lath5`
3. 设置：
   - **Framework preset**: Next.js
   - **Build command**: `cd apps/admin-frontend && npx next build`
   - **Build output directory**: `apps/admin-frontend/.next/static`
   - **Root directory**: `/`
4. 环境变量：
   ```
   NEXT_PUBLIC_API_URL=https://your-api-domain.com
   NEXT_PUBLIC_ADMIN_API_URL=https://your-admin-api-domain.com
   ```
5. 点击 Save and Deploy

方法 B — **wrangler CLI 手动部署**：

```bash
cd apps/admin-frontend
npx next build
npx wrangler pages deploy .next/static --project-name=rwa-lat-admin
```

---

## 第三部分：Core API + Admin API → Docker 部署

> Cloudflare Workers 不能跑 NestJS 长驻进程。Core API 和 Admin API 需要部署到 VPS 或云服务器。

### 前置条件

- 一台 Linux 服务器（2GB+ 内存）
- Docker + Docker Compose 已安装
- PostgreSQL 已运行（云 RDS 或 Docker 容器）

### 步骤 1：在服务器上拉代码

```bash
git clone https://github.com/wx6668888/rwa.lath5.git rwa-lat
cd rwa-lat
```

### 步骤 2：创建生产环境配置

```bash
cp deploy/production.env.example deploy/production.env
```

编辑 `deploy/production.env`，填入：

```env
# 数据库（替换为你的 PG 地址）
PRODUCTION_DATABASE_URL=postgresql://user:password@your-pg-host:5432/rwa_lat_prod
ADMIN_DATABASE_URL=postgresql://user:password@your-pg-host:5432/rwa_lat_prod

# 域名
PUBLIC_API_URL=https://api.rwa.lat
PUBLIC_APP_URL=https://h5.rwa.lat
PUBLIC_ADMIN_API_URL=https://admin-api.rwa.lat
CORS_ORIGINS=https://h5.rwa.lat

# 安全密钥（生成 64 位 hex）
IDENTITY_HMAC_KEY=<openssl rand -hex 32>
IDENTITY_ENC_KEY=<openssl rand -hex 32>
WALLET_WEBHOOK_SECRET=<openssl rand -hex 32>
METRICS_BEARER_TOKEN=<openssl rand -hex 32>

# 邮件
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASSWORD=your-password
EMAIL_FROM=no-reply@rwa.lat
```

### 步骤 3：运行数据库迁移

```bash
docker compose -f deploy/compose.production.yml --profile release run --rm migrate
```

### 步骤 4：启动服务

```bash
docker compose -f deploy/compose.production.yml up -d
```

验证：

```bash
curl http://localhost:4000/v1/health
curl http://localhost:4100/v1/admin/health
```

### 步骤 5：配置 Nginx 反向代理（HTTPS）

```nginx
# /etc/nginx/sites-available/rwa-lat-api.conf
server {
    listen 443 ssl http2;
    server_name api.rwa.lat;

    ssl_certificate /etc/letsencrypt/live/api.rwa.lat/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rwa.lat/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name admin-api.rwa.lat;

    ssl_certificate /etc/letsencrypt/live/admin-api.rwa.lat/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin-api.rwa.lat/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/rwa-lat-api.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 免费SSL证书
certbot --nginx -d api.rwa.lat -d admin-api.rwa.lat
```

---

## 第四部分：Cloudflare DNS 配置

在 Cloudflare Dashboard → 你的域名 → DNS：

| 类型 | 名称 | 内容 | 代理 |
|------|------|------|------|
| A | api | 你的服务器IP | 🔶 开启代理 |
| A | admin-api | 你的服务器IP | 🔶 开启代理 |
| CNAME | h5 | rwa-lat.workers.dev | 🔶 开启代理 |
| CNAME | admin | rwa-lat-admin.pages.dev | 🔶 开启代理 |

---

## 快速部署清单

```bash
# === 本地操作 ===
# 1. 确认代码已推到 GitHub
git push h5 main

# 2. 本地构建测试（可选）
npx next build

# === Cloudflare (H5 + Admin FE) ===
# 3. 登录 Cloudflare
npx wrangler login

# 4. 部署 H5
npx next build && npx opennextjs-cloudflare build && npx wrangler deploy

# 5. 部署 Admin FE (Pages Dashboard Git 连接，或 CLI)
cd apps/admin-frontend && npx next build
npx wrangler pages deploy .next/static --project-name=rwa-lat-admin

# === 服务器 (Core API + Admin API) ===
# 6. 服务器上克隆 + Docker
git clone https://github.com/wx6668888/rwa.lath5.git && cd rwa-lath5
cp deploy/production.env.example deploy/production.env
# 编辑 production.env 填入密钥和数据库
docker compose -f deploy/compose.production.yml --profile release run --rm migrate
docker compose -f deploy/compose.production.yml up -d

# 7. Nginx + SSL
# 配置反向代理 + certbot

# === Cloudflare DNS ===
# 8. 添加 DNS 记录，开启橙色代理
```

## 注意事项

1. **Cloudflare Workers 25MB 限制** — H5 的 `.open-next/worker.js` 必须小于 25MB。如果你的项目超了，用 `npx wrangler deploy --dry-run` 检查大小，再压缩静态资源。
2. **环境变量** — H5 的 API 请求需要通过 Cloudflare Workers 的环境变量指向你的 Core API 地址。在 `wrangler.jsonc` 里加：
   ```jsonc
   "vars": {
     "NEXT_PUBLIC_API_URL": "https://api.rwa.lat"
   }
   ```
3. **CORS** — Core API 的 `.env` 里 `CORS_ORIGINS` 需要包含你的 Cloudflare 域名。
4. **免费额度** — Workers 100K 请求/天，Pages 无限静态请求。超出需要升级到 Paid ($5/月)。
5. **数据库** — 生产环境建议用云 RDS（腾讯云/阿里云 PostgreSQL），不要在 Workers 里跑 PG。
