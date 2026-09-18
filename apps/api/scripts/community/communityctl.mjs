#!/usr/bin/env node
/**
 * RWA.LAT community operations CLI (content engine + operator tooling).
 *
 * All writes go through the Core API internal channel (/v1/internal/community/*)
 * with the shared service token + actor id, so posts flow through the same
 * service path (validation, counters) as anything else.
 *
 * Usage:
 *   node scripts/community/communityctl.mjs seed [--file personas.json]
 *   node scripts/community/communityctl.mjs publish-post --handle rachel.c --body "..." [--topics newbie,security] [--images url1,url2] [--source rewrite]
 *   node scripts/community/communityctl.mjs publish-comment --post-id <uuid> --handle rachel.c --body "..."
 *   node scripts/community/communityctl.mjs enqueue --file drafts.json
 *   node scripts/community/communityctl.mjs queue [--state draft]
 *   node scripts/community/communityctl.mjs review --id <uuid> --action approve|reject [--reviewer hermes] [--note "..."] [--scheduled-for ISO]
 *   node scripts/community/communityctl.mjs approve-all [--reviewer hermes]
 *   node scripts/community/communityctl.mjs publish-due
 *   node scripts/community/communityctl.mjs stats
 *   node scripts/community/communityctl.mjs feed [--sort latest|hot] [--topic rwa] [--limit 10]
 *   node scripts/community/communityctl.mjs like --handle aiden.wu --target-type post --target-id <uuid>
 *   node scripts/community/communityctl.mjs follow --follower rachel.c --followee laoliang.84
 *
 * Env:
 *   COMMUNITY_API        base URL (default http://localhost:4000)
 *   ADMIN_SERVICE_TOKEN  shared internal service token (required for writes)
 *   COMMUNITY_ACTOR_ID   actor uuid recorded on writes (default 5eed0001-...-0001)
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const API = (process.env.COMMUNITY_API ?? 'http://localhost:4000').replace(/\/$/, '')
const TOKEN = process.env.ADMIN_SERVICE_TOKEN ?? ''
const ACTOR = process.env.COMMUNITY_ACTOR_ID ?? '5eed0001-0000-4000-8000-000000000001'

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      args[key] = value
    } else {
      args._.push(token)
    }
  }
  return args
}

async function call(method, path, body, { auth = false } = {}) {
  const headers = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (auth) {
    if (!TOKEN) throw new Error('ADMIN_SERVICE_TOKEN is required for internal calls')
    headers.authorization = `Bearer ${TOKEN}`
    headers['x-actor-admin-id'] = ACTOR
  }
  const response = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  if (!response.ok) {
    const message = typeof parsed === 'object' && parsed ? JSON.stringify(parsed) : String(parsed)
    throw new Error(`${method} ${path} -> ${response.status}: ${message.slice(0, 400)}`)
  }
  return parsed
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function seed(args) {
  const file = resolve(args.file ?? join(HERE, 'personas.json'))
  const payload = JSON.parse(readFileSync(file, 'utf8'))
  const personas = payload.personas ?? payload
  if (!Array.isArray(personas)) throw new Error('personas file must contain a personas array')
  let created = 0
  for (const persona of personas) {
    const dto = {
      handle: persona.handle,
      displayName: persona.displayName,
      kind: persona.kind ?? 'persona',
      bio: persona.bio,
      city: persona.city,
      countryCode: persona.countryCode,
      timezone: persona.timezone,
      persona: { ...persona.persona, sample_posts: persona.sample_posts ?? [] },
    }
    const result = await call('POST', '/v1/internal/community/profiles', dto, { auth: true })
    created += 1
    console.log(`upserted @${result.handle} (${result.displayName}) ${result.city ?? ''}`)
  }
  console.log(`done: ${created}/${personas.length} personas synced`)
}

async function publishPost(args) {
  const topics = args.topics ? args.topics.split(',').map((t) => t.trim()).filter(Boolean) : undefined
  const images = args.images ? args.images.split(',').map((t) => t.trim()).filter(Boolean) : undefined
  const result = await call(
    'POST',
    '/v1/internal/community/posts',
    { handle: args.handle, body: args.body, topics, images, source: args.source, publishedAt: args['published-at'] },
    { auth: true },
  )
  console.log(JSON.stringify({ id: result.id, handle: result.author?.handle, publishedAt: result.publishedAt }, null, 2))
}

async function publishComment(args) {
  const result = await call(
    'POST',
    `/v1/internal/community/posts/${args['post-id']}/comments`,
    { handle: args.handle, body: args.body, parentId: args['parent-id'] },
    { auth: true },
  )
  console.log(JSON.stringify({ id: result.id, postId: result.postId }, null, 2))
}

async function enqueue(args) {
  const file = resolve(args.file)
  const items = JSON.parse(readFileSync(file, 'utf8'))
  const list = Array.isArray(items) ? items : items.items
  if (!Array.isArray(list)) throw new Error('drafts file must be an array or { items: [] }')
  const result = await call('POST', '/v1/internal/community/queue', { items: list }, { auth: true })
  console.log(`queued ${result.queued} item(s)`)
  for (const id of result.ids) console.log(`  ${id}`)
}

async function queue(args) {
  const query = args.state ? `?state=${encodeURIComponent(args.state)}` : ''
  const result = await call('GET', `/v1/internal/community/queue${query}`, undefined, { auth: true })
  for (const item of result.items) {
    const preview = String(item.payload?.body ?? '').replace(/\s+/g, ' ').slice(0, 70)
    console.log(`[${item.state}] ${item.id} @${item.profile?.handle} ${item.kind} :: ${preview}`)
  }
  console.log(`total ${result.items.length}`)
}

async function review(args) {
  const result = await call(
    'PUT',
    `/v1/internal/community/queue/${args.id}/review`,
    { action: args.action, reviewer: args.reviewer ?? 'hermes', note: args.note, scheduledFor: args['scheduled-for'] },
    { auth: true },
  )
  console.log(`${result.state} ${result.id}`)
}

async function approveAll(args) {
  const result = await call('GET', '/v1/internal/community/queue?state=draft', undefined, { auth: true })
  let approved = 0
  for (const item of result.items) {
    await call(
      'PUT',
      `/v1/internal/community/queue/${item.id}/review`,
      { action: 'approve', reviewer: args.reviewer ?? 'hermes', scheduledFor: item.scheduledFor ?? undefined },
      { auth: true },
    )
    approved += 1
    await sleep(80)
  }
  console.log(`approved ${approved}`)
}

async function publishDue() {
  const result = await call('POST', '/v1/internal/community/queue/publish-due', {}, { auth: true })
  console.log(JSON.stringify(result))
}

async function stats() {
  const result = await call('GET', '/v1/internal/community/stats', undefined, { auth: true })
  console.log(JSON.stringify(result, null, 2))
}

async function feed(args) {
  const query = new URLSearchParams()
  if (args.sort) query.set('sort', args.sort)
  if (args.topic) query.set('topic', args.topic)
  query.set('limit', args.limit ?? '10')
  const result = await call('GET', `/v1/community/feed?${query.toString()}`)
  for (const post of result.items) {
    const preview = String(post.body).replace(/\s+/g, ' ').slice(0, 76)
    console.log(`${post.publishedAt} @${post.author?.handle} ♥${post.likeCount} 💬${post.commentCount} :: ${preview}`)
  }
  console.log(`total ${result.items.length}; nextCursor=${result.nextCursor ?? 'null'}`)
}

async function like(args) {
  const result = await call(
    'POST',
    '/v1/internal/community/likes',
    { handle: args.handle, targetType: args['target-type'], targetId: args['target-id'] },
    { auth: true },
  )
  console.log(JSON.stringify(result))
}

async function follow(args) {
  const result = await call('POST', '/v1/internal/community/follows', { follower: args.follower, followee: args.followee }, { auth: true })
  console.log(JSON.stringify(result))
}

async function publishBatch(args) {
  const file = resolve(args.file)
  const items = JSON.parse(readFileSync(file, 'utf8'))
  const list = Array.isArray(items) ? items : items.items
  if (!Array.isArray(list)) throw new Error('batch file must be an array or { items: [] }')
  let published = 0
  for (const item of list) {
    const result = await call(
      'POST',
      '/v1/internal/community/posts',
      {
        handle: item.handle,
        body: item.body,
        topics: item.topics,
        images: item.images,
        source: item.source ?? 'original',
        publishedAt: item.publishedAt,
      },
      { auth: true },
    )
    published += 1
    console.log(`published ${result.id} @${result.author?.handle} ${item.publishedAt ?? ''}`)
    await sleep(60)
  }
  console.log(`done: ${published}/${list.length}`)
}

const commands = { seed, 'publish-post': publishPost, 'publish-batch': publishBatch, 'publish-comment': publishComment, enqueue, queue, review, 'approve-all': approveAll, 'publish-due': publishDue, stats, feed, like, follow }

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const command = args._[0]
  if (!command || !commands[command]) {
    console.log(`usage: communityctl.mjs <${Object.keys(commands).join('|')}>`)
    process.exit(command ? 1 : 0)
  }
  await commands[command](args)
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`)
  process.exit(1)
})
