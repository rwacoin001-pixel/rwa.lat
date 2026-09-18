# -*- coding: utf-8 -*-
"""把多语言改写映射应用到生产库（默认 dry-run；加 --yes 才真正写入）"""
import json
import sys

sys.path.insert(0, r'C:/Users/30396/AppData/Local/Temp/hermes-rwa-scripts')
import rwa_secrets
import psycopg2

DRY = '--yes' not in sys.argv
MAP = json.load(open('C:/Users/30396/AppData/Local/Temp/hermes-rwa-scripts/rewrite_map.json', encoding='utf-8'))
url = rwa_secrets.load()['PRODUCTION_DATABASE_URL']
conn = psycopg2.connect(url, connect_timeout=30)
cur = conn.cursor()

stats = {'posts_ok': 0, 'posts_missing': [], 'comments_ok': 0, 'comments_missing': [], 'bios_ok': 0, 'bios_missing': []}

for item in MAP['posts']:
    cur.execute(
        """
        SELECT p.id FROM app.community_posts p
        JOIN app.community_profiles pr ON pr.id = p.profile_id
        WHERE pr.handle = %s AND date_trunc('milliseconds', p.published_at) = %s::timestamptz
        """,
        (item['handle'], item['publishedAt']),
    )
    rows = cur.fetchall()
    if len(rows) != 1:
        stats['posts_missing'].append([item['handle'], item['publishedAt'], len(rows)])
        continue
    if not DRY:
        cur.execute(
            'UPDATE app.community_posts SET body = %s, lang = %s WHERE id = %s',
            (item['body'], item['lang'], rows[0][0]),
        )
    stats['posts_ok'] += 1

for item in MAP['comments']:
    cur.execute(
        """
        SELECT c.id FROM app.community_comments c
        JOIN app.community_profiles pr ON pr.id = c.profile_id
        WHERE pr.handle = %s AND date_trunc('milliseconds', c.created_at) = %s::timestamptz
        """,
        (item['handle'], item['createdAt']),
    )
    rows = cur.fetchall()
    if len(rows) != 1:
        stats['comments_missing'].append([item['handle'], item['createdAt'], len(rows)])
        continue
    if not DRY:
        cur.execute(
            'UPDATE app.community_comments SET body = %s, lang = %s WHERE id = %s',
            (item['body'], item['lang'], rows[0][0]),
        )
    stats['comments_ok'] += 1

for item in MAP['bios']:
    cur.execute('SELECT 1 FROM app.community_profiles WHERE handle = %s', (item['handle'],))
    if cur.fetchone() is None:
        stats['bios_missing'].append(item['handle'])
        continue
    if not DRY:
        cur.execute(
            'UPDATE app.community_profiles SET bio = %s, updated_at = now() WHERE handle = %s',
            (item['bio'], item['handle']),
        )
    stats['bios_ok'] += 1

if DRY:
    conn.rollback()
    print('== DRY RUN（未写入）==')
else:
    conn.commit()
    print('== 已提交写入 ==')
print(json.dumps(stats, ensure_ascii=False, indent=1))
