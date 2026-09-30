import tseslint from 'typescript-eslint'
export default [
  { ignores: ['node_modules/**', '.next/**', '.open-next/**', '.wrangler/**', 'apps/**', 'packages/**', 'public/**', 'contracts/**', 'design-concepts/**', 'design-audit/**', 'next-env.d.ts'] },
  { files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'scripts/**/*.{ts,mjs}'], languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } }, plugins: { '@typescript-eslint': tseslint.plugin }, rules: { 'no-debugger': 'error', 'no-constant-condition': 'error', 'no-duplicate-case': 'error', 'no-unreachable': 'error' } },
]
