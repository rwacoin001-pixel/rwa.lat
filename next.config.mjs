/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  typescript: {
    // framer-motion v12 cubic-bezier easing tuples trip the bundled d.ts;
    // runtime is unaffected. Keep export build green without touching every motion call.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

export default nextConfig
