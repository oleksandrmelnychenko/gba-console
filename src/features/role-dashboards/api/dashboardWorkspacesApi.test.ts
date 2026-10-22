import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getDashboardWorkspaceCatalog,
  normalizeDashboardWorkspaceCatalog,
  normalizeDashboardWorkspaceSummary,
} from './dashboardWorkspacesApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('dashboardWorkspacesApi', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('loads and normalizes a GBA workspace catalog', async () => {
    apiRequestMock.mockResolvedValue({
      CanSwitchWorkspace: true,
      DefaultWorkspace: 'gba',
      Workspaces: [
        { Group: 'Система', IsAi: true, Key: 'gba', Name: 'Огляд GBA' },
        { Group: 'Продажі', IsAi: true, Key: 'sales-head', Name: 'Відділ продажів' },
      ],
    })

    await expect(getDashboardWorkspaceCatalog()).resolves.toEqual({
      canSwitchWorkspace: true,
      defaultWorkspace: 'gba',
      workspaces: [
        { group: 'Система', isAi: true, key: 'gba', name: 'Огляд GBA' },
        { group: 'Продажі', isAi: true, key: 'sales-head', name: 'Відділ продажів' },
      ],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/dashboards/workspaces/catalog', undefined)
  })

  it('drops unknown keys and falls back to the first allowed workspace', () => {
    expect(normalizeDashboardWorkspaceCatalog({
      defaultWorkspace: 'not-allowed',
      workspaces: [
        { group: 'Фінанси', key: 'accounting', name: 'Бухгалтерія' },
        { group: 'Польща', key: 'polish-logistics', name: 'Польща' },
      ],
    })).toEqual({
      canSwitchWorkspace: false,
      defaultWorkspace: 'accounting',
      workspaces: [{ group: 'Фінанси', isAi: false, key: 'accounting', name: 'Бухгалтерія' }],
    })
  })

  it('normalizes summary metrics without trusting unknown tones or workspaces', () => {
    expect(normalizeDashboardWorkspaceSummary({
      Workspace: 'warehouse',
      From: '2026-07-01',
      To: '2026-07-12',
      GeneratedAtUtc: '2026-07-11T09:00:00Z',
      Metrics: [
        { Key: 'receipts', Label: 'Оприходувань', Route: '/products/income/documents', Tone: 'positive', Unit: 'count', Value: 4 },
        { Key: 'bad', Label: 'Невідомий тон', Tone: 'purple', Unit: 'qty', Value: '12.5' },
      ],
    }, 'system', { from: '2026-06-01', toExclusive: '2026-06-02' })).toEqual({
      cacheTtlSeconds: 30,
      dataFreshness: 'live',
      from: '2026-07-01',
      generatedAtUtc: '2026-07-11T09:00:00Z',
      metrics: [
        { coveragePercent: 100, hasData: true, key: 'receipts', label: 'Оприходувань', route: '/products/income/documents', timeBasis: 'unknown', tone: 'positive', unit: 'count', value: 4 },
        { coveragePercent: 100, hasData: true, key: 'bad', label: 'Невідомий тон', route: undefined, timeBasis: 'unknown', tone: 'neutral', unit: 'qty', value: 12.5 },
      ],
      to: '2026-07-12',
      workspace: 'warehouse',
    })
  })

  it.each([undefined, null, '', 'broken', Number.NaN, Number.POSITIVE_INFINITY, false])('does not turn invalid value %s into known zero', (value) => {
    const summary = normalizeDashboardWorkspaceSummary({ Metrics: [{ Key: 'negative-stock', Label: 'Залишки', Value: value, HasData: true }] }, 'warehouse', { from: '2026-10-01', toExclusive: '2026-11-01' })
    expect(summary.metrics[0]).toMatchObject({ hasData: false, coveragePercent: 0 })
  })

  it('retains legitimate zero while rejecting malformed coverage', () => {
    const summary = normalizeDashboardWorkspaceSummary({ Metrics: [{ Key: 'negative-stock', Label: 'Залишки', Value: 0, CoveragePercent: 'broken', TimeBasis: 'current' }] }, 'warehouse', { from: '2026-10-01', toExclusive: '2026-11-01' })
    expect(summary.metrics[0]).toMatchObject({ hasData: true, value: 0, coveragePercent: 0, timeBasis: 'current' })
  })

  it('rejects a missing metrics collection instead of presenting a successful empty summary', () => {
    expect(() => normalizeDashboardWorkspaceSummary({}, 'warehouse', { from: '2026-10-01', toExclusive: '2026-11-01' })).toThrow()
  })
})
