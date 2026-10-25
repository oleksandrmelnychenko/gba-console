const react = require('@vitejs/plugin-react').default
const { uiActionGuardPlugin } = require('./scripts/ui-action-guard-plugin.mjs')
const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  plugins: [uiActionGuardPlugin(), react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
