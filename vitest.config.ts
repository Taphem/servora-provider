import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
    // Integration tests share one external Postgres instance and truncate
    // provider tables between tests; running test files in parallel would let
    // one file's reset truncate rows another file is mid-assertion on.
    fileParallelism: false,
  },
});
