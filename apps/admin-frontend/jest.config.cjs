module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\\.[tj]sx?$': '<rootDir>/test/typescript-transform.cjs' },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
}
