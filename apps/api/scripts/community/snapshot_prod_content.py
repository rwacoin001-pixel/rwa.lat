# -*- coding: utf-8 -*-
"""只读：抓取生产社区内容快照（posts/comments/profiles）到 JSON，供多语言改写映射。"""
import json
import sys

sys.path.insert(0, r'C:/Users/30396/AppData/Local/Temp/hermes-rwa-scripts')
import rwa_secrets
import psycopg2

url = rwa_secrets.load()['PRODUCTION_DATABASE_URL']
conn = psycopg2.connect(url, connect_timeout=30)
cur = conn.cursor()

out = {}

cur.execute(
    """
    SELECT pr.handle, p.body, p.lang, to_char(p.published_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    FROM app.community_posts p
    JOIN app.community_profiles pr ON pr.id = p.profile_id
    WHERE p.state = 'published'
    ORDER BY p.published_at
    """
)
out['posts'] = [{'handle': r[0], 'body': r[1], 'lang': r[2], 'publishedAt': r[3]} for r in cur.fetchall()]

cur.execute(
    """
    SELECT pr.handle, c.body, c.lang, to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    FROM app.community_comments c
    JOIN app.community_profiles pr ON pr.id = c.profile_id
    ORDER BY c.created_at
    """
)
out['comments'] = [{'handle': r[0], 'body': r[1], 'lang': r[2], 'createdAt': r[3]} for r in cur.fetchall()]

cur.execute('SELECT handle, display_name, bio, city, country_code FROM app.community_profiles ORDER BY handle')
out['profiles'] = [
    {'handle': r[0], 'displayName': r[1], 'bio': r[2], 'city': r[3], 'countryCode': r[4]} for r in cur.fetchall()
]

path = 'C:/Users/30396/AppData/Local/Temp/hermes-rwa-scripts/prod_content_snapshot.json'
with open(path, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, ensure_ascii=False, indent=2)

print('posts:', len(out['posts']))
print('comments:', len(out['comments']))
print('profiles:', len(out['profiles']))
print('written to', path)
