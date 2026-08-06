// The QA worker runs with NODE_ENV=production, which makes React expose its
// production build without the test-only act() helper.
process.env.NODE_ENV = 'test'

const react = require('@vitejs/plugin-react').default
const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
