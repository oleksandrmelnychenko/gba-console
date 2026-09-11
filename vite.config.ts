import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

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

function emitBuildInfo(buildNumber: string): Plugin {
  return {
    name: 'emit-build-info',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build.json',
        source: JSON.stringify({ build: buildNumber }),
      })
    },
  }
}

function resolveBuildNumber() {
  if (process.env.VITE_BUILD_NUMBER) return process.env.VITE_BUILD_NUMBER
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`
}

// https://vite.dev/config/
const buildNumber = resolveBuildNumber()

export default defineConfig(({ mode }) => {
  // Vite loads dotenv files after evaluating its config. Load the proxy settings
  // here too, so .env.local can direct both API and Analytics to local services.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'https://gba-api-dev.85.17.167.167.nip.io'

  return {
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  plugins: [stripSignalRPureAnnotations(), emitBuildInfo(buildNumber), react()],
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
              name: 'vendor-xlsx',
              test: /node_modules[\\/]xlsx[\\/]/,
              priority: 35,
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
      // Permission-scoped warehouse verification endpoints belong to the main API.
      '^/api/v1/[^/]+/history/order/item/warehouse-ukraine/verification/': {
        target: apiProxyTarget,
        changeOrigin: true,
        xfwd: true,
        secure: false,
        configure: configureForwardedHeaders,
      },
      '^/api/v1/[^/]+/(history|report)': {
        target: env.VITE_DEV_HISTORY_PROXY_TARGET || 'https://gba-analytics-dev.85.17.167.167.nip.io',
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
  }
})
