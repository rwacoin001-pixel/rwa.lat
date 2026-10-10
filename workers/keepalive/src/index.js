// Check the canonical Oracle endpoints every 4 minutes.

const TARGETS = [
  'https://api.a-reit.com/v1/health/ready',
  'https://admin-api.a-reit.com/v1/admin/health',
  'https://admin.a-reit.com/login',
];

async function ping(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'rwa-keepalive/1.0' },
    });
    return `${url} -> ${r.status} (${Date.now() - t0}ms)`;
  } catch (e) {
    return `${url} -> ERR ${e.name} (${Date.now() - t0}ms)`;
  } finally {
    clearTimeout(timer);
  }
}

export default {
  // Cron 触发（主逻辑）
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const results = await Promise.all(TARGETS.map(ping));
        console.log('[keepalive]', results.join(' | '));
      })()
    );
  },
  // 手动访问可查看当前状态
  async fetch(request) {
    const results = await Promise.all(TARGETS.map(ping));
    return new Response('rwa-keepalive OK @ ' + new Date().toISOString() + '\n' + results.join('\n'), {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
