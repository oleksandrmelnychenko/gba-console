import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderWithMantine } from '../../../test/renderWithMantine'
import { getSalesGeography } from '../api/salesGeographyApi'
import { geographySummary } from '../testFixtures'
import type { GeographyRegion, SalesGeographySummary } from '../types'
import { SalesGeographyPage } from './SalesGeographyPage'

vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: translate }) }))
function translate(value: string) { return value }
vi.mock('../api/salesGeographyApi', () => ({ getSalesGeography: vi.fn() }))
vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, columns, isLoading }: { data: GeographyRegion[]; columns: { id: string; cell: (row: GeographyRegion) => ReactNode }[]; isLoading: boolean }) =>
    isLoading ? null : <table aria-label="Регіони"><tbody>{data.map(row => <tr key={row.code}>{columns.map(column => <td key={column.id}>{column.cell(row)}</td>)}</tr>)}</tbody></table>,
}))
const getSummary = vi.mocked(getSalesGeography)
beforeEach(() => { getSummary.mockReset() })

function mount() { return renderWithMantine(<SalesGeographyPage />) }

describe('geography page', () => {
  it('shows server boundaries, evidence limits and consistent cents in total, rows and map', async () => {
    getSummary.mockResolvedValue(geographySummary())
    mount()
    expect(await screen.findByText('€2,80')).toBeTruthy()
    expect(screen.getByText('Період: 01.01.2025 — 23.10.2026 (включно, Київ)')).toBeTruthy()
    expect(screen.getByText(/Повноту завантаження історії не підтверджено/)).toBeTruthy()
    expect(screen.getAllByText('€1,40').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('img', { name: 'Полтавська: €1,40, 2 клієнтів' })).toBeTruthy()
  })
  it('sends each selected period and no period for current debt', async () => {
    getSummary.mockImplementation(async params => geographySummary(params?.metric))
    mount()
    await screen.findByText('€2,80')
    expect(getSummary.mock.calls[0][0]).toEqual({ metric: 'sales', period: 'all' })
    for (const months of [12, 24, 36]) {
      fireEvent.click(screen.getByRole('radio', { name: `${months} міс` }))
      await waitFor(() => expect(getSummary).toHaveBeenLastCalledWith({ metric: 'sales', months }, expect.any(AbortSignal)))
    }
    fireEvent.click(screen.getByRole('radio', { name: 'Борг' }))
    await screen.findByText('Увесь поточний борг, включно з непростроченим')
    expect(getSummary).toHaveBeenLastCalledWith({ metric: 'debt' }, expect.any(AbortSignal))
    expect(screen.queryByText(/Період: 01.01.2025/)).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Продажі' }))
    await waitFor(() => expect(getSummary).toHaveBeenLastCalledWith({ metric: 'sales', months: 36 }, expect.any(AbortSignal)))
  })
  it('labels unknown totals as partial and displays a loaded-history warning', async () => {
    const summary = geographySummary()
    summary.From = '2024-10-23'
    summary.TotalEur = null
    summary.UnresolvedAmountCount = 2
    summary.Rows[0] = { ...summary.Rows[0], ValueEur: null, UnresolvedAmountCount: 2 }
    getSummary.mockResolvedValue(summary)
    mount()
    expect(await screen.findByText('Відомо: €2,80')).toBeTruthy()
    expect(screen.getByText(/Обраний період починається раніше/)).toBeTruthy()
    expect(screen.getByText(/Відомий підсумок є частковим/)).toBeTruthy()
    expect(screen.queryByText('€2,80')).toBeNull()
    expect(screen.getByRole('img', { name: 'Полтавська: Сума не визначена, Відомо: €1,40, 2 клієнтів' }).getAttribute('stroke-dasharray')).toBe('3 2')
  })
  it('clears totals when a reload fails instead of showing old values or zero', async () => {
    getSummary.mockResolvedValueOnce(geographySummary()).mockRejectedValueOnce(new Error('HTTP 503'))
    mount()
    await screen.findByText('€2,80')
    fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))
    expect(await screen.findByText('HTTP 503')).toBeTruthy()
    expect(screen.queryByText('€2,80')).toBeNull()
    expect(screen.queryByText('€0,00')).toBeNull()
  })
  it('ignores an older response when switching metrics', async () => {
    let completeSales!: (value: SalesGeographySummary) => void
    getSummary.mockImplementation(params => params?.metric === 'debt'
      ? Promise.resolve({ ...geographySummary('debt'), AsOfUtc: '2026-10-23T11:00:00Z' })
      : new Promise(resolve => { completeSales = resolve }))
    mount()
    fireEvent.click(screen.getByRole('radio', { name: 'Борг' }))
    await screen.findByText('Увесь поточний борг, включно з непростроченим')
    await act(async () => completeSales(geographySummary()))
    expect(screen.getByText('Увесь поточний борг, включно з непростроченим')).toBeTruthy()
    expect(screen.queryByText(/Період: 01.01.2025/)).toBeNull()
    expect(getSummary.mock.calls[0][1]?.aborted).toBe(true)
  })
})
