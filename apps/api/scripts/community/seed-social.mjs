#!/usr/bin/env node
/**
 * Community engagement seeding: follows (from persona relation graph), likes on
 * circle posts, and a scripted set of human-written comment exchanges.
 * Run AFTER backfill so posts exist. All through the internal channel.
 *
 * Usage: node scripts/community/seed-social.mjs [--file personas.json]
 * Env: COMMUNITY_API, ADMIN_SERVICE_TOKEN, COMMUNITY_ACTOR_ID (see communityctl.mjs)
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const API = (process.env.COMMUNITY_API ?? 'http://localhost:4000').replace(/\/$/, '')
const TOKEN = process.env.ADMIN_SERVICE_TOKEN ?? ''
const ACTOR = process.env.COMMUNITY_ACTOR_ID ?? '5eed0001-0000-4000-8000-000000000001'

async function call(method, path, body) {
  const headers = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (TOKEN) {
    headers.authorization = `Bearer ${TOKEN}`
    headers['x-actor-admin-id'] = ACTOR
  }
  const response = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${String(text).slice(0, 300)}`)
  return parsed
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const COMMENT_SCRIPT = [
  { by: 'laoliang.84', onAuthor: 'rachel.c', contains: '充值', body: '第一次都这样（我第一次转了三遍才敢点确认）。习惯就好。但记牢一点：任何让你"加急"、让你往私人地址转的"客服"，全是骗子' },
  { by: 'mika.toronto', onAuthor: 'rachel.c', contains: '白皮书', body: '同文科生报到🙋 我也是先看风险页再看别的，这个顺序其实是科学的' },
  { by: 'aiden.wu', onAuthor: 'laoliang.84', contains: '算力租赁', body: '补充一点：电力合同还要看固定价还是浮动价。浮动价撑起来的"稳定收益"，在电价高峰季会原形毕露' },
  { by: 'marcus.sg', onAuthor: 'aiden.wu', contains: 'H100', body: '这个区间基本符合我们看到的报价。再补一句：同一批卡，带运维团队的和裸租的，价差也不小' },
  { by: 'rachel.c', onAuthor: 'laoliang.84', contains: '四个字拉人', body: '记住了，谢谢提醒……我前几天还差点被群里的一个"老师"唬住，幸好先来这边看了几个帖子' },
  { by: 'xiaolu.jb', onAuthor: 'june.bkk', contains: '三份', body: '这个分法好可爱，"资料库"哈哈哈哈，我宣布这个概念被我偷走了' },
  { by: 'june.bkk', onAuthor: 'xiaolu.jb', contains: '气氛组', body: '气氛组组长你好呀，我是副组长😆' },
  { by: 'azhe.tpe', onAuthor: 'grace.nyc', contains: '10%', body: '我身边也差不多。大家嘴上激进，真到掏钱的时候全保守。这可能就是宣传和现实的差距' },
  { by: 'sam.dubai', onAuthor: 'kenji.tokyo', contains: '日元', body: '在迪拜这边做日贸的朋友也天天念叨这个。稳定币结算确实是刚需，不是概念' },
  { by: 'grace.nyc', onAuthor: 'marcus.sg', contains: '确权', body: '把"确权"放在第一刀，这个框架值得展开。有空写个续集？' },
  { by: 'daniel.lon', onAuthor: 'azhe.tpe', contains: '费率', body: '你反馈的这个口径问题抓得挺准。费用条款的解释权在谁手里，比数字本身更重要' },
]

async function main() {
  if (!TOKEN) throw new Error('ADMIN_SERVICE_TOKEN is required')
  const file = resolve(process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : join(HERE, 'personas.json'))
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const personas = data.personas ?? data
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : 'all'

  // 1) follows from the relation graph
  let follows = 0
  for (const persona of only === 'all' || only === 'follows' ? personas : []) {
    const targets = persona.persona?.relations?.follows ?? []
    for (const target of targets) {
      try {
        const result = await call('POST', '/v1/internal/community/follows', { follower: persona.handle, followee: target })
        if (result.created) follows += 1
      } catch (error) {
        console.warn(`follow ${persona.handle}->${target}: ${error.message}`)
      }
      await sleep(40)
    }
  }
  console.log(`follows created: ${follows}`)

  // 2) likes on circle members' posts
  const feed = await call('GET', '/v1/community/feed?sort=latest&limit=50')
  const posts = feed.items ?? []
  let likes = 0
  let likeSeq = 7
  for (const persona of only === 'all' || only === 'likes' ? personas : []) {
    const circle = new Set([...(persona.persona?.relations?.follows ?? []), ...(persona.persona?.relations?.close_with ?? [])])
    const candidates = posts.filter((post) => post.author && circle.has(post.author.handle))
    for (const post of candidates.slice(0, 2)) {
      likeSeq += 1
      if (likeSeq % 5 === 0) continue // leave some posts unliked for realism
      try {
        const result = await call('POST', '/v1/internal/community/likes', { handle: persona.handle, targetType: 'post', targetId: post.id })
        if (result.created) likes += 1
      } catch (error) {
        console.warn(`like by ${persona.handle}: ${error.message}`)
      }
      await sleep(40)
    }
  }
  console.log(`likes created: ${likes}`)

  // 3) scripted comment exchanges
  let comments = 0
  for (const script of only === 'all' || only === 'comments' ? COMMENT_SCRIPT : []) {
    const target = posts.find((post) => post.author?.handle === script.onAuthor && String(post.body).includes(script.contains))
    if (!target) {
      console.warn(`comment target not found: ${script.onAuthor} / ${script.contains}`)
      continue
    }
    try {
      await call('POST', `/v1/internal/community/posts/${target.id}/comments`, { handle: script.by, body: script.body })
      comments += 1
    } catch (error) {
      console.warn(`comment by ${script.by}: ${error.message}`)
    }
    await sleep(60)
  }
  console.log(`comments created: ${comments}`)

  const stats = await call('GET', '/v1/internal/community/stats')
  console.log(`stats: ${JSON.stringify(stats)}`)
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`)
  process.exit(1)
})
