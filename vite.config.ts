import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
              priority: 50,
            },
            {
              name: 'vendor-mantine',
              test: /node_modules[\\/]@mantine[\\/]/,
              priority: 40,
            },
            {
              name: 'vendor-table',
              test: /node_modules[\\/](@tanstack|@dnd-kit)[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-icons',
              test: /node_modules[\\/]@tabler[\\/]icons-react[\\/]/,
              priority: 20,
              maxSize: 180 * 1024,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 10,
              maxSize: 240 * 1024,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET || 'https://gba-api-dev.85.17.167.167.nip.io',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
