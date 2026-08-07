import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

const nginxConfig = readFileSync(join(cwd(), 'nginx.conf'), 'utf8')

describe('nginx Docker service discovery', () => {
  it('re-resolves API containers after compose recreates them', () => {
    expect(nginxConfig).toContain('resolver 127.0.0.11 valid=10s ipv6=off;')
    expect(nginxConfig).toContain('set $api_proxy_upstream ${API_PROXY_TARGET};')
    expect(nginxConfig).toContain('set $api_history_proxy_upstream ${API_HISTORY_PROXY_TARGET};')
    expect(nginxConfig).not.toContain('proxy_pass ${API_PROXY_TARGET};')
    expect(nginxConfig).not.toContain('proxy_pass ${API_HISTORY_PROXY_TARGET};')
  })

  it('routes API, realtime, images, and documents through dynamic upstreams', () => {
    expect(nginxConfig.match(/proxy_pass \$api_proxy_upstream;/g)).toHaveLength(4)
    expect(nginxConfig.match(/proxy_pass \$api_history_proxy_upstream;/g)).toHaveLength(3)
  })
})
