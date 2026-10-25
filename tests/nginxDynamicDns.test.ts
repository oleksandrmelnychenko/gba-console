import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

const nginxConfig = readFileSync(join(cwd(), 'nginx.conf'), 'utf8')

describe('nginx Docker service discovery', () => {
  it('re-resolves API containers after compose recreates them', () => {
    expect(nginxConfig).toContain('resolver 127.0.0.11 valid=10s ipv6=off;')
    expect(nginxConfig).toMatch(/map \$gba_env \$api_proxy_upstream \{\s+default \$\{API_PROXY_TARGET\};\s+qa \$\{API_QA_PROXY_TARGET\};/)
    expect(nginxConfig).toMatch(/map \$gba_env \$api_history_proxy_upstream \{\s+default \$\{API_HISTORY_PROXY_TARGET\};\s+qa \$\{API_QA_HISTORY_PROXY_TARGET\};/)
    expect(nginxConfig).toContain('set $api_auth_upstream $api_proxy_upstream;')
    expect(nginxConfig).not.toContain('proxy_pass ${API_PROXY_TARGET};')
    expect(nginxConfig).not.toContain('proxy_pass ${API_HISTORY_PROXY_TARGET};')
  })

  it('routes API, realtime, images, and documents through dynamic upstreams', () => {
    expect(nginxConfig.match(/proxy_pass \$api_proxy_upstream;/g)).toHaveLength(5)
    expect(nginxConfig.match(/proxy_pass \$api_history_proxy_upstream;/g)).toHaveLength(3)
    expect(nginxConfig.match(/proxy_pass \$api_auth_upstream;/g)).toHaveLength(1)
  })

  it('selects QA only for the QA cookie when the QA backend is enabled', () => {
    expect(nginxConfig).toMatch(/map "\$cookie_gba_env:\$\{GBA_QA_ENABLED\}" \$gba_env \{\s+default dev;\s+"qa:true" qa;/)
    expect(nginxConfig).toContain(`return 200 '{"active":"$gba_env","qaAvailable":\${GBA_QA_ENABLED}}';`)
  })

  it('keeps login, refresh and logout in the same environment as session-protected APIs', () => {
    expect(nginxConfig).toContain('set $api_auth_upstream $api_proxy_upstream;')
    expect(nginxConfig).not.toContain('set $api_auth_upstream ${API_PROXY_TARGET};')
    const tokenRoute = nginxConfig.indexOf('location ~ ^/api/v1/[^/]+/usermanagement/token(/|$) {')
    expect(tokenRoute).toBeGreaterThan(-1)
    expect(tokenRoute).toBeLessThan(nginxConfig.indexOf('location /api/ {'))
    expect(nginxConfig.slice(tokenRoute, nginxConfig.indexOf('}', tokenRoute))).toContain('proxy_pass $api_auth_upstream;')
  })
})
