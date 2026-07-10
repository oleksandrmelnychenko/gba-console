import { describe, expect, it } from 'vitest'
import type { AiFleetServiceDefinition, AiFleetServiceStatus } from '../types'
import {
  buildAiFleetAnalytics,
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

const NOW_MS = new Date('2026-07-08T12:00:00Z').getTime()

const statuses: AiFleetServiceStatus[] = [
  {
    health: { state: 'healthy' },
    serviceId: 'products',
    warmup: {
      lastFinishedAtUtc: '2026-07-08T05:05:00Z',
      lastStartedAtUtc: '2026-07-08T05:00:00Z',
      state: 'healthy',
    },
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
    const rows = buildAiFleetServiceViews(services, statuses, NOW_MS)

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
    const [, row] = buildAiFleetServiceViews(services, statuses, NOW_MS)
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

  it('builds operational analytics for charts and next actions', () => {
    const rows = buildAiFleetServiceViews(services, statuses, NOW_MS)
    const analytics = buildAiFleetAnalytics(
      rows,
      {
        lastFinishedAtUtc: '2026-07-08T05:07:00Z',
        lastStartedAtUtc: '2026-07-08T05:00:00Z',
        state: 'healthy',
      },
      NOW_MS,
    )

    expect(analytics.healthDistribution).toEqual({ down: 1, healthy: 1, unknown: 0 })
    expect(analytics.warmupDistribution).toEqual({ down: 1, healthy: 1, unknown: 0 })
    expect(analytics.operationDurationMinutes).toBe(7)
    expect(analytics.operationAgeHours).toBe(6.9)
    expect(analytics.apiBreakdown).toEqual({ fail: 1, pass: 1, total: 2, unknown: 0, warning: 0 })
    expect(analytics.warmupBreakdown).toEqual({ fail: 1, pass: 1, total: 2, unknown: 0, warning: 0 })
    expect(analytics.apiBreakdown.total + analytics.warmupBreakdown.total).toBe(analytics.totalCheckCount)
    expect(analytics.apiBreakdown.pass + analytics.warmupBreakdown.pass).toBe(analytics.passedCheckCount)
    expect(
      analytics.apiBreakdown.fail
      + analytics.apiBreakdown.pass
      + analytics.apiBreakdown.unknown
      + analytics.apiBreakdown.warning,
    ).toBe(analytics.apiBreakdown.total)
    expect(
      analytics.warmupBreakdown.fail
      + analytics.warmupBreakdown.pass
      + analytics.warmupBreakdown.unknown
      + analytics.warmupBreakdown.warning,
    ).toBe(analytics.warmupBreakdown.total)
    expect(analytics.passedCheckCount).toBe(2)
    expect(analytics.totalCheckCount).toBe(4)
    expect(analytics.totalReadinessPercent).toBe(50)
    expect(analytics.readinessRows[0]).toMatchObject({
      readinessPercent: 0,
      serviceName: 'gba-nba',
      warmupAgeHours: 6.9,
    })
    expect(analytics.nextActions).toEqual([
      {
        message: 'Health check не проходить. Перевірити проксі, ключі та upstream сервіс.',
        serviceId: 'nba',
        serviceName: 'gba-nba',
        severity: 'danger',
      },
    ])
  })

  it('marks old warmup snapshots as stale even when the state is healthy', () => {
    const rows = buildAiFleetServiceViews(services, [
      {
        health: { state: 'healthy' },
        serviceId: 'products',
        warmup: {
          lastFinishedAtUtc: '2026-07-06T05:00:00Z',
          state: 'healthy',
        },
      },
    ], NOW_MS)
    const analytics = buildAiFleetAnalytics(rows, undefined, NOW_MS)

    expect(analytics.staleWarmupCount).toBe(1)
    expect(rows[0]).toMatchObject({ isProblem: true, isStaleWarmup: true, warmupAgeHours: 55 })
    expect(buildAiFleetSummary(rows).problemCount).toBe(2)
    expect(analytics.warmupBreakdown).toEqual({ fail: 0, pass: 0, total: 2, unknown: 1, warning: 1 })
    expect(analytics.warmupDistribution).toEqual({ down: 0, healthy: 0, unknown: 2 })
    expect(analytics.readinessRows).toEqual([
      expect.objectContaining({
        isStaleWarmup: false,
        readinessPercent: 0,
        serviceId: 'nba',
      }),
      expect.objectContaining({
        isStaleWarmup: true,
        readinessPercent: 50,
        serviceId: 'products',
        warmupAgeHours: 55,
      }),
    ])
    expect(analytics.nextActions).toContainEqual({
      message: 'Статус 05:00 застарів. Перевірити scheduler або вручну запустити warmup.',
      serviceId: 'products',
      serviceName: 'gba-products',
      severity: 'warning',
    })
  })

  it('does not count a healthy warmup without a completion time as ready', () => {
    const rows = buildAiFleetServiceViews([services[0]], [
      {
        health: { state: 'healthy' },
        serviceId: 'products',
        warmup: { state: 'healthy' },
      },
    ], NOW_MS)
    const analytics = buildAiFleetAnalytics(rows, undefined, NOW_MS)

    expect(rows[0].isProblem).toBe(true)
    expect(buildAiFleetSummary(rows).warmupHealthy).toBe(0)
    expect(analytics.totalReadinessPercent).toBe(50)
    expect(analytics.nextActions).toContainEqual({
      message: '05:00 статус не має часу завершення. Перевірити формат warmup telemetry.',
      serviceId: 'products',
      serviceName: 'gba-products',
      severity: 'warning',
    })
  })

  it('treats exactly 30 hours as fresh and 30 hours plus one millisecond as stale', () => {
    const rows = buildAiFleetServiceViews(services, [
      {
        health: { state: 'healthy' },
        serviceId: 'products',
        warmup: {
          lastFinishedAtUtc: '2026-07-07T06:00:00.000Z',
          state: 'healthy',
        },
      },
      {
        health: { state: 'healthy' },
        serviceId: 'nba',
        warmup: {
          lastFinishedAtUtc: '2026-07-07T05:59:59.999Z',
          state: 'healthy',
        },
      },
    ], NOW_MS)
    const analytics = buildAiFleetAnalytics(rows, undefined, NOW_MS)
    const readinessByService = new Map(analytics.readinessRows.map((row) => [row.serviceId, row]))

    expect(readinessByService.get('products')).toMatchObject({
      isStaleWarmup: false,
      readinessPercent: 100,
      warmupCheckState: 'pass',
    })
    expect(readinessByService.get('nba')).toMatchObject({
      isStaleWarmup: true,
      readinessPercent: 50,
      warmupCheckState: 'warning',
    })
    expect(analytics.warmupBreakdown).toEqual({ fail: 0, pass: 1, total: 2, unknown: 0, warning: 1 })
    expect(analytics.warmupDistribution).toEqual({ down: 0, healthy: 1, unknown: 1 })
  })

  it('classifies operation thresholds from exact intervals instead of rounded labels', () => {
    const atLimit = buildAiFleetAnalytics([], {
      lastFinishedAtUtc: '2026-07-07T06:00:00.000Z',
      lastStartedAtUtc: '2026-07-07T05:30:00.000Z',
      state: 'healthy',
    }, NOW_MS)
    const overLimit = buildAiFleetAnalytics([], {
      lastFinishedAtUtc: '2026-07-07T05:59:59.999Z',
      lastStartedAtUtc: '2026-07-07T05:29:59.998Z',
      state: 'healthy',
    }, NOW_MS)

    expect(atLimit).toMatchObject({
      operationAgeHours: 30,
      operationAgeState: 'pass',
      operationDurationMinutes: 30,
      operationDurationState: 'pass',
    })
    expect(overLimit).toMatchObject({
      operationAgeHours: 30,
      operationAgeState: 'warning',
      operationDurationMinutes: 30,
      operationDurationState: 'fail',
    })
  })

  it.each([
    ['missing', undefined],
    ['invalid', 'not-a-date'],
    ['future', '2026-07-08T12:00:00.001Z'],
  ])('treats a healthy warmup with a %s completion time as unknown', (_case, lastFinishedAtUtc) => {
    const rows = buildAiFleetServiceViews([services[0]], [
      {
        health: { state: 'healthy' },
        serviceId: 'products',
        warmup: { lastFinishedAtUtc, state: 'healthy' },
      },
    ], NOW_MS)
    const analytics = buildAiFleetAnalytics(rows, undefined, NOW_MS)

    expect(rows[0]).toMatchObject({ isProblem: true, isStaleWarmup: false, warmupAgeHours: null })
    expect(analytics.readinessRows[0]).toMatchObject({
      readinessPercent: 50,
      warmupAgeHours: null,
      warmupCheckState: 'unknown',
    })
    expect(analytics.warmupBreakdown).toEqual({ fail: 0, pass: 0, total: 1, unknown: 1, warning: 0 })
    expect(analytics.warmupDistribution).toEqual({ down: 0, healthy: 0, unknown: 1 })
    expect(analytics.passedCheckCount).toBe(1)
    expect(analytics.totalCheckCount).toBe(2)
  })
})
