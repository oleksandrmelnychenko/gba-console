// The QA worker runs with NODE_ENV=production, which makes React expose its
// production build without the test-only act() helper.
process.env.NODE_ENV = 'test'

const react = require('@vitejs/plugin-react').default
const { configDefaults, defineConfig } = require('vitest/config')

module.exports = defineConfig({
  plugins: [react()],
  test: {
    // Playwright owns these suites; importing them through Vitest fails before
    // collection and makes the unit-test release gate report false failures.
    exclude: [...configDefaults.exclude, '**/e2e/**'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
