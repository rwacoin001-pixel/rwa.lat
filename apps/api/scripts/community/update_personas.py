# -*- coding: utf-8 -*-
"""同步 personas.json：加入 posting_lang；简介与 rewrite_map 的 bios 对齐。"""
import json

P = 'D:/rwa-lat/apps/api/scripts/community/personas.json'
M = 'C:/Users/30396/AppData/Local/Temp/hermes-rwa-scripts/rewrite_map.json'

POSTING_LANG = {
    'rachel.c': 'zh-Hans',
    'laoliang.84': 'zh-Hant',
    'aiden.wu': 'en',
    'mika.toronto': 'en',
    'grace.nyc': 'en',
    'daniel.lon': 'en',
    'marcus.sg': 'en',
    'xiaolu.jb': 'zh-Hans',
    'azhe.tpe': 'zh-Hant',
    'kenji.tokyo': 'ja',
    'sam.dubai': 'en',
    'june.bkk': 'en',
}

data = json.load(open(P, encoding='utf-8'))
rmap = json.load(open(M, encoding='utf-8'))
bios = {b['handle']: b['bio'] for b in rmap['bios']}

count = 0
changed = []
for persona in data['personas']:
    h = persona['handle']
    if h in POSTING_LANG:
        persona['posting_lang'] = POSTING_LANG[h]
    if h in bios and persona.get('bio') != bios[h]:
        persona['bio'] = bios[h]
        changed.append(h)
    count += 1

json.dump(data, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
with open(P, 'a', encoding='utf-8') as f:
    f.write('\n')
print('personas:', count)
print('bio 更新:', changed)
print('posting_lang 写入:', {p['handle']: p.get('posting_lang') for p in data['personas']})
