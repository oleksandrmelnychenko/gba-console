import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { WorkspaceSummary } from './WorkspaceSummary'
import type { DashboardWorkspaceSummary } from '../types'

const metric = { key: 'receivables-eur', label: 'Борги', value: 0, hasData: true, coveragePercent: null, tone: 'neutral' as const, unit: 'EUR', timeBasis: 'current' as const }
function show(overrides: Partial<DashboardWorkspaceSummary> = {}) {
  const summary: DashboardWorkspaceSummary = { workspace: 'finance', from: '2026-10-01', to: '2026-11-01', generatedAtUtc: new Date().toISOString(), cacheTtlSeconds: 300, dataFreshness: 'source-watermark-unknown', metrics: [metric], ...overrides }
  return render(<MantineProvider><I18nProvider><MemoryRouter><WorkspaceSummary state={{ summary, error: null, isRefreshing: false, reload: vi.fn() }} /></MemoryRouter></I18nProvider></MantineProvider>)
}
describe('financial evidence presentation', () => {
  it('keeps a known zero distinct from missing conversion and shows the missing-source reason', () => {
    show({ metrics: [metric, { ...metric, key: 'unknown', label: 'Невідомо', hasData: false, unknownReason: 'Історичний курс відсутній' }] })
    expect(screen.getByText('0,00')).toBeTruthy()
    expect(screen.getByText('Немає даних')).toBeTruthy()
    expect(screen.getByText('Історичний курс відсутній')).toBeTruthy()
    expect(screen.queryByText('100%')).toBeNull()
    expect(screen.getByText(/Час розрахунку не підтверджує/)).toBeTruthy()
  })
  it('marks expired cached values even when the last response was successful', () => {
    show({ generatedAtUtc: new Date(Date.now() - 301_000).toISOString() })
    expect(screen.getByText(/Показники застаріли/)).toBeTruthy()
  })
})
