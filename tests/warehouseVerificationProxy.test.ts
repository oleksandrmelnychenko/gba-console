import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const nginx = readFileSync('nginx.conf', 'utf8')
const vite = readFileSync('vite.config.ts', 'utf8')
const nginxRoutes = [...nginx.matchAll(/location ~ (\S+) \{([\s\S]*?)\n  \}/g)]
const viteRoutes = [...vite.matchAll(/'([^']+)': \{([\s\S]*?)\n      \}/g)]

function nginxTarget(path: string) {
  return nginxRoutes.find(([, pattern]) => new RegExp(pattern).test(path))?.[2]
}
function viteTarget(path: string) {
  return viteRoutes.find(([, pattern]) => pattern.startsWith('^') && new RegExp(pattern).test(path))?.[2]
}

describe('warehouse verification proxy routing', () => {
  it.each(['registry', 'export'])('routes %s to the main API before the history catch-all', (action) => {
    for (const language of ['uk', 'en']) {
      const path = `/api/v1/${language}/history/order/item/warehouse-ukraine/verification/${action}?storageId=1&from=2026-09-08`
      expect(nginxTarget(path)).toContain('proxy_pass $api_proxy_upstream;')
      expect(viteTarget(path)).toContain('target: apiProxyTarget,')
    }
  })
  it.each(['/history/order/item/get', '/report/revenue'])('keeps analytics routing for %s', (suffix) => {
    expect(nginxTarget(`/api/v1/uk${suffix}`)).toContain('proxy_pass $api_history_proxy_upstream;')
    expect(viteTarget(`/api/v1/uk${suffix}`)).toContain('VITE_DEV_HISTORY_PROXY_TARGET')
  })
})
