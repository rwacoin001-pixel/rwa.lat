#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
rwa-admin — RWA.LAT 运营工具集 v1（只读）
=========================================
手机控制后端的前置工具层：给运营/巡检/日报提供统一入口。
将来可整体搬到服务器（微信助手）使用。

用法:
  python rwa-admin.py status          # 服务健康探测
  python rwa-admin.py stats           # 核心运营统计
  python rwa-admin.py users [N]       # 最近注册用户（默认 10）
  python rwa-admin.py queue           # 社区内容审核队列
  python rwa-admin.py sync            # 数据同步与覆盖度
  python rwa-admin.py report          # 生成日报文本（中文）
  python rwa-admin.py report --send   # 生成日报并推送微信

数据源: DPAPI 金库（PRODUCTION_DATABASE_URL，只读查询）+ 公开健康端点
环境变量: RWA_SECRETS_HELPER 覆盖金库助手目录（服务器迁移时用）
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

SECRETS_HELPER = os.environ.get(
    'RWA_SECRETS_HELPER', 'C:/Users/30396/AppData/Local/Temp/hermes-rwa-scripts')
sys.path.insert(0, SECRETS_HELPER)
import rwa_secrets  # noqa: E402
import psycopg2  # noqa: E402

CORE = 'https://api.rwa.lat'
ADMIN = 'https://admin-api.rwa.lat'
WORKER = 'https://rwa-lat.rwacoin001.workers.dev'

_conn = None


def conn():
    global _conn
    if _conn is None:
        d = rwa_secrets.load()
        _conn = psycopg2.connect(d['PRODUCTION_DATABASE_URL'], connect_timeout=30)
        _conn.set_session(readonly=True)  # 只读会话——工具层绝不写库
    return _conn


def q(sql, params=None):
    cur = conn().cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    return rows


def q1(sql, params=None):
    r = q(sql, params)
    return r[0][0] if r else None


def probe(url, timeout=60):
    t0 = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(
            url, headers={'User-Agent': 'rwa-admin/1.0'}), timeout=timeout)
        return r.status, int((time.time() - t0) * 1000)
    except urllib.error.HTTPError as e:
        return e.code, int((time.time() - t0) * 1000)
    except Exception:
        return None, int((time.time() - t0) * 1000)


# ---------------------------------------------------------------- status
def cmd_status():
    print('RWA.LAT 服务状态 · %s' % time.strftime('%Y-%m-%d %H:%M'))
    for label, url in [
        ('核心 API', CORE + '/v1/health'),
        ('管理 API', ADMIN + '/v1/admin/health'),
        ('新站 Worker', WORKER + '/'),
    ]:
        code, ms = probe(url)
        mark = '✓' if code and code < 500 else ('✗' if code is None else '⚠')
        print('  %s %-12s %s (%dms)' % (mark, label, code or 'ERR', ms))


# ---------------------------------------------------------------- stats
def gather_stats():
    s = {}
    s['users_total'] = q1("SELECT count(*) FROM app.users WHERE status <> 'closed'")
    s['users_today'] = q1("SELECT count(*) FROM app.users WHERE created_at >= date_trunc('day', now())")
    s['users_7d'] = q1("SELECT count(*) FROM app.users WHERE created_at > now() - interval '7 days'")
    s['active_24h'] = q1("SELECT count(DISTINCT user_id) FROM app.sessions WHERE last_seen_at > now() - interval '24 hours'")
    s['kyc'] = dict(q("SELECT state, count(*) FROM app.kyc_cases GROUP BY state ORDER BY 2 DESC"))
    s['baskets'] = q1("SELECT count(*) FROM app.basket_portfolios")
    s['subs'] = dict(q("SELECT status, count(*) FROM app.basket_subscriptions GROUP BY status"))
    s['redemptions'] = dict(q("SELECT status, count(*) FROM app.basket_redemptions GROUP BY status"))
    s['posts'] = q1("SELECT count(*) FROM app.community_posts")
    s['queue'] = dict(q("SELECT state, count(*) FROM app.community_content_queue GROUP BY state"))
    s['reports'] = q1("SELECT count(*) FROM app.community_reports")
    s['tickets'] = dict(q("SELECT status, count(*) FROM app.tickets GROUP BY status ORDER BY 2 DESC"))
    s['assets'] = q1("SELECT count(*) FROM app.rwa_assets")
    s['ai_analysis'] = q1("SELECT count(*) FROM app.rwa_ai_analysis")
    s['metrics'] = q1("SELECT count(*) FROM app.rwa_asset_metrics")
    r = q("SELECT provider, kind, status, started_at, items_upserted, items_failed FROM app.rwa_sync_runs ORDER BY started_at DESC LIMIT 1")
    s['last_sync'] = r[0] if r else None
    return s


def cmd_stats():
    s = gather_stats()
    print('RWA.LAT 运营统计 · %s' % time.strftime('%Y-%m-%d %H:%M'))
    print(' 用户: 总 %s | 今日 +%s | 7日 +%s | 24h 活跃 %s' % (
        s['users_total'], s['users_today'], s['users_7d'], s['active_24h']))
    print(' KYC : %s' % (s['kyc'] or '无'))
    print(' 组合: 组合 %s | 申购 %s | 赎回 %s' % (s['baskets'], s['subs'] or '—', s['redemptions'] or '—'))
    print(' 社区: 帖 %s | 待审 %s | 举报 %s' % (s['posts'], s['queue'] or '—', s['reports']))
    print(' 工单: %s' % (s['tickets'] or '无'))
    print(' 资产: %s | AI 分析 %s | 指标行 %s' % (s['assets'], s['ai_analysis'], s['metrics']))
    if s['last_sync']:
        p, k, st, at, up, fail = s['last_sync']
        print(' 最近同步: %s/%s %s @ %s（写入 %s / 失败 %s）' % (p, k, st, at, up, fail))


# ---------------------------------------------------------------- users
def cmd_users(n=10):
    rows = q("""SELECT id, status, locale, created_at FROM app.users
                ORDER BY created_at DESC LIMIT %s""", (int(n),))
    print('最近注册用户（%d）:' % len(rows))
    for uid, status, locale, created in rows:
        print('  %s…  %-8s %-6s %s' % (uid[:13], status, locale or '-', created.strftime('%m-%d %H:%M')))


# ---------------------------------------------------------------- queue
def cmd_queue():
    print('社区内容队列:')
    for state, cnt in q("SELECT state, count(*) FROM app.community_content_queue GROUP BY state ORDER BY 2 DESC"):
        print('  %-12s %s' % (state, cnt))
    rows = q("""SELECT id, kind, source, scheduled_for, created_at FROM app.community_content_queue
                WHERE state IN ('pending','scheduled','draft') ORDER BY created_at DESC LIMIT 8""")
    if rows:
        print(' 待处理预览:')
        for i, kind, source, sched, created in rows:
            print('   %s… %-8s %-10s %s' % (str(i)[:8], kind, source or '-', created.strftime('%m-%d %H:%M')))


# ---------------------------------------------------------------- sync
def cmd_sync():
    print('数据同步（最近 6 次）:')
    for p, k, st, at, up, fail in q("""SELECT provider, kind, status, started_at, items_upserted, items_failed
                                       FROM app.rwa_sync_runs ORDER BY started_at DESC LIMIT 6"""):
        print('  %-14s %-10s %-8s %s  写入 %s/失败 %s' % (p or '-', k or '-', st or '-', at, up, fail))
    fresh = q1("SELECT max(updated_at) FROM app.rwa_assets")
    print('  资产表最近更新:', fresh)
    print('  AI 分析覆盖: %s 个资产' % q1("SELECT count(DISTINCT asset_id) FROM app.rwa_ai_analysis")
          if _has_col('rwa_ai_analysis', 'asset_id') else
          '  AI 分析行数: %s' % q1("SELECT count(*) FROM app.rwa_ai_analysis"))


def _has_col(table, col):
    try:
        return bool(q("""SELECT 1 FROM information_schema.columns
                         WHERE table_schema='app' AND table_name=%s AND column_name=%s""",
                      (table, col)))
    except Exception:
        return False


# ---------------------------------------------------------------- report
def cmd_report(send=False):
    s = gather_stats()
    core_code, core_ms = probe(CORE + '/v1/health')
    admin_code, admin_ms = probe(ADMIN + '/v1/admin/health')
    L = []
    L.append('📊 RWA.LAT 日报 · %s' % time.strftime('%m-%d'))
    L.append('')
    L.append('▪️ 服务: 核心API %s(%dms) · 管理API %s(%dms)' % (
        '✓' if core_code == 200 else core_code, core_ms,
        '✓' if admin_code == 200 else admin_code, admin_ms))
    L.append('▪️ 用户: 总 %s | 今日 +%s | 7日 +%s | 24h活跃 %s' % (
        s['users_total'], s['users_today'], s['users_7d'], s['active_24h']))
    kyc = s['kyc'] or {}
    L.append('▪️ KYC: %s' % (' · '.join('%s %s' % (k, v) for k, v in kyc.items()) or '暂无案件'))
    L.append('▪️ 组合: %s 个' % s['baskets'])
    qd = s['queue'] or {}
    L.append('▪️ 社区: 帖 %s | 队列 %s | 举报 %s' % (
        s['posts'], ' · '.join('%s %s' % (k, v) for k, v in qd.items()) or '空', s['reports']))
    tk = s['tickets'] or {}
    L.append('▪️ 工单: %s' % (' · '.join('%s %s' % (k, v) for k, v in tk.items()) or '无'))
    L.append('▪️ 资产: %s 个 | AI 分析 %s' % (s['assets'], s['ai_analysis']))
    if s['last_sync']:
        p, k, st, at, up, fail = s['last_sync']
        L.append('▪️ 同步: %s %s @ %s（+%s/-%s）' % (k, st, str(at)[:16], up, fail))
    text = '\n'.join(L)
    print(text)
    if send:
        r = subprocess.run(['hermes', 'send', '--to', 'weixin', text],
                           capture_output=True, text=True, timeout=120)
        ok = r.returncode == 0 and 'Sent' in (r.stdout or '')
        print('\n[微信推送] %s' % ('成功 ✓' if ok else '失败: %s %s' % (r.returncode, (r.stderr or r.stdout)[:200])))


# ---------------------------------------------------------------- main
def main():
    args = sys.argv[1:]
    cmd = args[0] if args else 'status'
    if cmd == 'status':
        cmd_status()
    elif cmd == 'stats':
        cmd_stats()
    elif cmd == 'users':
        cmd_users(args[1] if len(args) > 1 else 10)
    elif cmd == 'queue':
        cmd_queue()
    elif cmd == 'sync':
        cmd_sync()
    elif cmd == 'report':
        cmd_report('--send' in args)
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
