import type { MetadataRoute } from 'next'

const privatePaths = [
  '/home',
  '/assets',
  '/wallet',
  '/portfolio',
  '/orders',
  '/activity',
  '/notifications',
  '/profile',
  '/secondary',
  '/statements',
  '/ai/plan',
  '/ai/goals',
  '/plan/new',
  '/basket/*/order',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Googlebot must be able to fetch protected page shells and observe their noindex metadata.
      { userAgent: 'Googlebot', allow: '/' },
      // These tokens control model training/search crawling, not Google Search indexing.
      {
        userAgent: [
          'Google-Extended',
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-SearchBot',
          'PerplexityBot',
          'Applebot-Extended',
          'Bytespider',
          'CCBot',
        ],
        disallow: privatePaths,
      },
      { userAgent: '*', disallow: privatePaths },
    ],
  }
}
