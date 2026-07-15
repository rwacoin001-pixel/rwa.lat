#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# RWA.LAT — 一键启动脚本
# 启动顺序: PostgreSQL → Core API → Admin API → H5 → Admin Frontend
# ═══════════════════════════════════════════════════════════════════════════
# 服务端口:
#   PostgreSQL       5432  (WSL Ubuntu 24.04)
#   H5 / PWA         3030  (Next.js 16)
#   Admin Frontend   3100  (Next.js 14)
#   Core API          4000  (NestJS)
#   Admin API         4100  (NestJS)
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

# ─── 颜色 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}[$(date +%H:%M:%S)]✓${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)✗${NC} $*"; }

# ─── 1. PostgreSQL (WSL) ─────────────────────────────────────────────────
log "1/5 启动 PostgreSQL (WSL)..."
wsl -- sudo service postgresql restart 2>/dev/null || true
sleep 1
if netstat -an 2>/dev/null | grep -q "5432.*LISTENING"; then
  ok "PostgreSQL 监听 :5432"
else
  err "PostgreSQL 未就绪, 请手动确认 WSL: wsl -- sudo service postgresql restart"
  exit 1
fi

# ─── 2. Core API (NestJS :4000) ──────────────────────────────────────────
log "2/5 启动 Core API (:4000)..."
cd "$ROOT/apps/api"
# 确保已构建
if [ ! -d "dist" ]; then
  log "  首次构建 Core API..."
  npx nest build 2>&1 | tail -3
fi
# 运行数据库迁移
node -e "
require('dotenv').config();
const { buildDatabaseOptions } = require('./dist/database/database-options');
const { DataSource } = require('typeorm');
const ds = new DataSource({ ...buildDatabaseOptions(process.env), migrationsRun: true });
ds.initialize().then(() => { console.log('  迁移完成'); ds.destroy(); }).catch(e => { console.error('  迁移失败:', e.message); process.exit(1); });
" 2>&1 && ok "数据库迁移完成" || err "迁移失败, 继续..."

# ─── 3. 启动所有服务 (后台) ──────────────────────────────────────────────
echo ""
log "启动 4 个服务进程..."
echo "┌────────────────────────────┐"
echo "│  PostgreSQL  →  :5432  ✓  │"
echo "└────────────────────────────┘"
echo ""

# Core API (:4000)
log "启动 Core API (:4000)..."
cd "$ROOT/apps/api"
node dist/main.js &
API_PID=$!
echo $API_PID > /tmp/rwa-api.pid

sleep 3

# Admin API (:4100)
log "启动 Admin API (:4100)..."
cd "$ROOT/apps/admin"
if [ ! -d "dist" ]; then
  log "  首次构建 Admin API..."
  npx nest build 2>&1 | tail -3
fi
node dist/main.js &
ADMIN_PID=$!
echo $ADMIN_PID > /tmp/rwa-admin-api.pid

sleep 2

# H5 (:3030)
log "启动 H5 (:3030)..."
cd "$ROOT"
npx next dev -p 3030 &
H5_PID=$!
echo $H5_PID > /tmp/rwa-h5.pid

sleep 2

# Admin Frontend (:3100)
log "启动 Admin Frontend (:3100)..."
cd "$ROOT/apps/admin-frontend"
npx next dev -p 3100 &
ADMIN_FE_PID=$!
echo $ADMIN_FE_PID > /tmp/rwa-admin-fe.pid

sleep 5

# ─── 4. 健康检查 ──────────────────────────────────────────────────────────
log "健康检查..."
echo ""

check() {
  local name=$1 url=$2
  if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "^[23]"; then
    ok "$name  →  $url"
  else
    err "$name  →  $url (未就绪)"
  fi
}

check "Core API"       "http://localhost:4000/v1/health"
check "Admin API"      "http://localhost:4100/v1/admin/health"
check "H5"             "http://localhost:3030/"
check "Admin Frontend" "http://localhost:3100/"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  RWA.LAT Demo 已启动"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  H5 (用户端)      http://localhost:3030"
echo "  Admin Frontend   http://localhost:3100"
echo "  Core API         http://localhost:4000/v1/health"
echo "  Admin API        http://localhost:4100/v1/admin/health"
echo "  PostgreSQL       localhost:5432 (db: rwa_lat_dev)"
echo ""
echo "  停止全部服务:    bash $0 stop"
echo "══════════════════════════════════════════════════════════"

# ─── Stop 子命令 ───────────────────────────────────────────────────────────
# bash dev-all.sh stop   →  杀掉所有 PID
if [ "${1:-}" = "stop" ]; then
  for pidfile in /tmp/rwa-api.pid /tmp/rwa-admin-api.pid /tmp/rwa-h5.pid /tmp/rwa-admin-fe.pid; do
    if [ -f "$pidfile" ]; then
      kill "$(cat $pidfile)" 2>/dev/null || true
      rm -f "$pidfile"
    fi
  done
  log "所有服务已停止"
  exit 0
fi
