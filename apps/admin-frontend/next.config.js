const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const isProduction = process.env.NODE_ENV === 'production';

// Browser uploads PUT straight to presigned object-storage URLs; list those origins here.
// Production storage is Backblaze B2 (S3_ENDPOINT=https://s3.<region>.backblazeb2.com, path-style).
// `||` so an empty ADMIN_CSP_CONNECT_SRC (as in .env.example) keeps the defaults instead of blocking uploads.
const storageConnectSrc = (process.env.ADMIN_CSP_CONNECT_SRC?.trim() || 'https://*.backblazeb2.com https://*.r2.cloudflarestorage.com https://*.amazonaws.com')
  .split(/[\s,]+/)
  .filter(Boolean);

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  ['connect-src', "'self'", ...storageConnectSrc, ...(isProduction ? [] : ['ws:', 'http://localhost:*'])].join(' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // pnpm links `next` from the monorepo root, so both roots must point at the repo root or
  // Turbopack refuses to compile files it considers "outside the project directory".
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
  // No next/image usage; previews are plain <img> tags on presigned storage URLs, so the optimizer stays off.
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
