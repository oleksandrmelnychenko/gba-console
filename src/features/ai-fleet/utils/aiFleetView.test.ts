import { describe, expect, it } from 'vitest'
import type { AiFleetServiceDefinition, AiFleetServiceStatus } from '../types'
import {
  buildAiFleetDiagnosticText,
  buildAiFleetServiceViews,
  buildAiFleetSummary,
  getAiFleetPrimaryRoute,
} from './aiFleetView'

const services: AiFleetServiceDefinition[] = [
  {
    description: 'Products intelligence',
    healthPath: '/products/intelligence/health',
    id: 'products',
    location: '/products/assortment',
    name: 'gba-products',
    source: 'ProductsApi',
  },
  {
    description: 'Sales tasks',
    healthPath: '/sales/cockpit/health',
    id: 'nba',
    location: '/sales/cockpit, /sales/cockpit/head',
    name: 'gba-nba',
    source: 'GbaNbaApi',
  },
]

const statuses: AiFleetServiceStatus[] = [
  {
    health: { state: 'healthy' },
    serviceId: 'products',
    warmup: { state: 'healthy' },
  },
  {
    health: { message: '503', state: 'down' },
    serviceId: 'nba',
    warmup: {
      lastFinishedAtUtc: '2026-07-08T05:06:00Z',
      message: 'failed',
      state: 'down',
    },
  },
]

describe('aiFleetView', () => {
  it('builds service views and marks non-healthy rows as problems', () => {
    const rows = buildAiFleetServiceViews(services, statuses)

    expect(rows).toMatchObject([
      { healthState: 'healthy', isProblem: false, primaryRoute: '/products/assortment', warmupState: 'healthy' },
      { healthState: 'down', isProblem: true, primaryRoute: '/sales/cockpit', warmupState: 'down' },
    ])
    expect(buildAiFleetSummary(rows)).toEqual({
      checked: 2,
      healthDown: 1,
      healthHealthy: 1,
      problemCount: 1,
      total: 2,
      warmupDown: 1,
      warmupHealthy: 1,
    })
  })

  it('extracts the first routable location', () => {
    expect(getAiFleetPrimaryRoute('Картка клієнта -> Платоспроможність')).toBeNull()
    expect(getAiFleetPrimaryRoute('/basket-supply-ukraine-order/dashboard, /basket-supply-ukraine-order/cockpit')).toBe(
      '/basket-supply-ukraine-order/dashboard',
    )
  })

  it('formats a useful diagnostic snapshot', () => {
    const [, row] = buildAiFleetServiceViews(services, statuses)
    const diagnostic = buildAiFleetDiagnosticText(row, {
      lastFinishedAtUtc: '2026-07-08T05:07:00Z',
      logFilePath: '/app/Logs/ai_warmup_log.txt',
      state: 'down',
    })

    expect(diagnostic).toContain('AI service: gba-nba')
    expect(diagnostic).toContain('Health: down')
    expect(diagnostic).toContain('05:00 message: failed')
    expect(diagnostic).toContain('Log: /app/Logs/ai_warmup_log.txt')
  })
})
