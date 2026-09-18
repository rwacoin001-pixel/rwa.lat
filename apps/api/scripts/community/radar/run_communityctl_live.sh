#!/usr/bin/env bash
# 线上 communityctl 安全执行器：令牌从金库取，全程不回显。
# 用法: bash run_communityctl_live.sh queue --state draft
set -e
cd /d/rwa-lat/apps/api
export COMMUNITY_API=https://api.rwa.lat
export ADMIN_SERVICE_TOKEN="$(python -c "import sys; sys.path.insert(0, r'C:/Users/30396/AppData/Local/Temp/hermes-rwa-scripts'); import rwa_secrets; print(rwa_secrets.load()['ADMIN_SERVICE_TOKEN'])")"
node scripts/community/communityctl.mjs "$@"
