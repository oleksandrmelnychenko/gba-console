import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'https://gba-api-dev.85.17.167.167.nip.io'
type ProxyConfigure = NonNullable<ProxyOptions['configure']>

const configureForwardedHeaders: ProxyConfigure = (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.setHeader('X-Forwarded-Proto', 'http')
  })
}

function stripSignalRPureAnnotations() {
  return {
    name: 'strip-signalr-pure-annotations',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('@microsoft/signalr/dist/esm/Utils.js')) {
        return null
      }

      return code.replaceAll('/*#__PURE__*/ function ', 'function ')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [stripSignalRPureAnnotations(), react()],
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
    watch: {
      ignored: ['**/.vs/**'],
    },
    proxy: {
      '^/api/v1/[^/]+/history': {
        target: process.env.VITE_DEV_HISTORY_PROXY_TARGET || 'https://gba-analytics-dev.85.17.167.167.nip.io',
        changeOrigin: true,
        xfwd: true,
        secure: false,
      },
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        xfwd: true,
        secure: false,
        configure: configureForwardedHeaders,
      },
      '/hubs': {
        target: apiProxyTarget,
        changeOrigin: true,
        xfwd: true,
        secure: false,
        ws: true,
        configure: configureForwardedHeaders,
      },
      '/Data': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/Images': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
