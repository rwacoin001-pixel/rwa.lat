module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testTimeout: 30_000,
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
}
