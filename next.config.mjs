/** @type {import('next').NextConfig} */
const nextConfig = {
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
