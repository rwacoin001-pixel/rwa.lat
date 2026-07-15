type SeedEnvironment = { APP_ENV?: string; NODE_ENV?: string }

// Demo records are allowed only in explicitly non-financial environments.
// Staging and production schemas stay structurally identical but data-clean.
export function shouldApplyDemoSeed(env: SeedEnvironment): boolean {
  if (env.NODE_ENV === 'test') return true
  const appEnvironment = env.APP_ENV ?? (env.NODE_ENV === 'production' ? 'production' : 'development')
  return appEnvironment === 'development' || appEnvironment === 'test' || appEnvironment === 'demo'
}
