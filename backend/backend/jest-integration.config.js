/** Jest config for DB-backed integration tests. Opt-in: RUN_INTEGRATION=1 pnpm test:integration */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          types: ['jest', 'node'],
        },
      },
    ],
  },
  testEnvironment: 'node',
  testTimeout: 120000,
};
