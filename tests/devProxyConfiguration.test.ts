import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import exportedConfig from '../vite.config'

const temporaryDirectories: string[] = []

async function proxyTargets(files: Record<string, string>, environment: Record<string, string> = {}, mode = 'development') {
  const directory = mkdtempSync(join(tmpdir(), 'gba-dev-proxy-'))
  temporaryDirectories.push(directory)
  for (const [name, content] of Object.entries(files)) writeFileSync(join(directory, name), content)
  for (const key of Object.keys(process.env).filter(key => key.startsWith('VITE_'))) vi.stubEnv(key, undefined)
  for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value)
  vi.spyOn(process, 'cwd').mockReturnValue(directory)
  const config = typeof exportedConfig === 'function'
    ? await exportedConfig({ command: 'serve', mode }) : await exportedConfig
  return Object.fromEntries(Object.entries(config.server?.proxy ?? {}).map(([route, options]) =>
    [route, typeof options === 'string' ? options : options.target]))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('local development proxy configuration', () => {
  it('loads both local backend addresses from .env.local', async () => {
    const targets = await proxyTargets({ '.env.local': 'VITE_DEV_API_PROXY_TARGET=http://localhost:35981\nVITE_DEV_HISTORY_PROXY_TARGET=http://localhost:35982\n' })
    expect(targets['/api']).toBe('http://localhost:35981')
    expect(targets['/hubs']).toBe('http://localhost:35981')
    expect(targets['/Data']).toBe('http://localhost:35981')
    expect(targets['/Images']).toBe('http://localhost:35981')
    expect(targets['^/api/v1/[^/]+/(history|report)']).toBe('http://localhost:35982')
    expect(targets['^/api/v1/[^/]+/history/order/item/warehouse-ukraine/verification/']).toBe('http://localhost:35981')
  })

  it('uses development hosts when no overrides are configured', async () => {
    const targets = await proxyTargets({})
    expect(targets['/api']).toBe('https://gba-api-dev.85.17.167.167.nip.io')
    expect(targets['^/api/v1/[^/]+/(history|report)']).toBe('https://gba-analytics-dev.85.17.167.167.nip.io')
  })

  it('keeps shell environment overrides ahead of dotenv files', async () => {
    const targets = await proxyTargets({ '.env.local': 'VITE_DEV_API_PROXY_TARGET=http://localhost:35981\nVITE_DEV_HISTORY_PROXY_TARGET=http://localhost:35982\n' }, {
      VITE_DEV_API_PROXY_TARGET: 'http://127.0.0.1:45981',
      VITE_DEV_HISTORY_PROXY_TARGET: 'http://127.0.0.1:45982',
    })
    expect(targets['/api']).toBe('http://127.0.0.1:45981')
    expect(targets['^/api/v1/[^/]+/(history|report)']).toBe('http://127.0.0.1:45982')
  })

  it('honours the selected mode and its local overrides', async () => {
    const targets = await proxyTargets({
      '.env': 'VITE_DEV_API_PROXY_TARGET=http://localhost:35981\nVITE_DEV_HISTORY_PROXY_TARGET=http://localhost:35982\n',
      '.env.test': 'VITE_DEV_HISTORY_PROXY_TARGET=http://localhost:45982\n',
      '.env.test.local': 'VITE_DEV_HISTORY_PROXY_TARGET=http://localhost:55982\n',
    }, {}, 'test')
    expect(targets['/api']).toBe('http://localhost:35981')
    expect(targets['^/api/v1/[^/]+/(history|report)']).toBe('http://localhost:55982')
  })
})
