import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// Nest relies on decorator metadata, which esbuild does not emit; SWC does.
const plugins = [swc.vite({ module: { type: 'es6' } })]

export default defineConfig({
  test: {
    projects: [
      {
        plugins,
        test: { name: 'unit', include: ['test/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        plugins,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['test/integration/global-setup.ts'],
          // One test database is shared, so files run one after another.
          fileParallelism: false,
          // Flows make dozens of database round trips; a distant Neon region needs more than 30 seconds.
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
