/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenNext consumes the standalone server output for Cloudflare Workers builds.
  output: "standalone",
  experimental: {
    // Keep local Windows production builds deterministic and avoid worker-spawn exhaustion.
    cpus: 1,
  },
  typescript: {
    // framer-motion v12 cubic-bezier easing tuples trip the bundled d.ts;
    // runtime is unaffected. Keep build green without touching every motion call.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
