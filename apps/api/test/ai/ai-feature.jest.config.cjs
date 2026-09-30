const path = require('node:path')

module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['<rootDir>/test/ai/*.spec.ts'],
  cacheDirectory: path.resolve(__dirname, '../../../../.superpowers/sdd/2026-09-30-ai-customer-investment/jest-cache'),
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: { ...require('../../tsconfig.json').compilerOptions, isolatedModules: true, incremental: false },
      diagnostics: false,
    }],
  },
}
