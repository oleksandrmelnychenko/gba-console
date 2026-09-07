import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, getOneCTurnoverScopes } from '../api/reportsApi'
import { OneCTurnoverReportPanel } from './OneCTurnoverReportPanel'
import type { OneCTurnoverScopeSummary } from '../types'

vi.mock('../api/reportsApi', () => ({ createStockReport: vi.fn(), getOneCTurnoverScopes: vi.fn() }))
const scope: OneCTurnoverScopeSummary = {
  Key: 'A'.repeat(64), Filters: { OrganizationIds: ['1'.repeat(32)], ProductKindId: '2'.repeat(32), ExcludeServices: true },
  OrganizationNames: ['Тестова організація 1С'], FirstDay: '2026-09-01', LastDay: '2026-09-03', LoadedDayCount: 2,
  OldestReadCompletedUtc: '2026-09-06T10:00:00Z', NewestReadCompletedUtc: '2026-09-06T10:00:01Z',
}

function mount(canGenerate = true) {
  return render(<MantineProvider env="test"><I18nProvider>
    <OneCTurnoverReportPanel canGenerate={canGenerate} from="2026-09-01" to="2026-09-03" onFromChange={vi.fn()} onToChange={vi.fn()} />
  </I18nProvider></MantineProvider>)
}

async function selectScope() {
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Завантажені відбори 1С' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Завантажені відбори 1С' }), { key: 'ArrowDown', code: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: /Тестова організація 1С/ }))
}

describe('consolidated 1C report panel', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.clearAllMocks()
    vi.mocked(getOneCTurnoverScopes).mockResolvedValue([scope])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  })

  it('does not fetch or generate without the existing permission', () => {
    mount(false)
    expect(getOneCTurnoverScopes).not.toHaveBeenCalled()
    const submit = screen.getByRole('button', { name: 'Сформувати звіт 1С' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)
    expect(createStockReport).not.toHaveBeenCalled()
  })

  it('requires explicit scope choice and does not infer coverage from a date range', async () => {
    mount()
    await selectScope()
    expect(screen.getByText(/Між цими датами можуть бути пропуски/)).toBeTruthy()
    expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Сформувати звіт 1С' }))
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 1, oneC: scope.Filters, selections: [], from: '2026-09-01', to: '2026-09-03' })
    await screen.findByText(/Сервер не повернув файл звіту 1С/)
  })

  it('shows incomplete coverage without falling back to operational data', async () => {
    const message = 'Період звіту 1С ще не завантажено повністю для цих відборів.'
    vi.mocked(createStockReport).mockRejectedValue(new ApiError(message, 409, null))
    mount()
    await selectScope()
    fireEvent.click(screen.getByRole('button', { name: 'Сформувати звіт 1С' }))
    await screen.findByText(message)
    expect(createStockReport).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Відкрити сформований звіт 1С' })).toBeNull()
  })

  it('explains empty catalogue without claiming ordinary document sync loaded the ledger', async () => {
    vi.mocked(getOneCTurnoverScopes).mockResolvedValue([])
    mount()
    await screen.findByText(/Ще немає завантажених відборів 1С/)
    expect((screen.getByRole('button', { name: 'Сформувати звіт 1С' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not hide permission denial as an empty catalogue', async () => {
    vi.mocked(getOneCTurnoverScopes).mockRejectedValue(new ApiError('Forbidden', 403, null))
    mount()
    await screen.findByText(/Недостатньо прав для формування звітів 1С/)
    expect(screen.queryByText(/Ще немає завантажених відборів 1С/)).toBeNull()
  })
})
