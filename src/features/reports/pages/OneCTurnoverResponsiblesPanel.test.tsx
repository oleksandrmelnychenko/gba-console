import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStockReport } from '../api/reportsApi'
import { organizationOnlyScope } from '../data/oneCTurnoverScopes.test-fixtures'
import { OneCTurnoverResponsiblesPanel } from './OneCTurnoverResponsiblesPanel'
import { ApiError } from '../../../shared/api/apiClient'
import type { ReportResult } from '../types'
vi.mock('../api/reportsApi', () => ({ createStockReport: vi.fn() }))
vi.mock('../../../shared/ui/AppDateInput', () => ({ AppDateInput: ({ label, ...props }: { label: string }) => <label>{label}<input {...props} /></label> }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: ({ opened, title, document, onClose }: {
  opened: boolean; title: string; document?: { DocumentURL?: string }; onClose: () => void
}) => opened ? <div role="dialog" aria-label={title}><a href={document?.DocumentURL}>Excel</a><button onClick={onClose}>Закрити файл</button></div> : null }))
const file: ReportResult = { document: { DocumentURL: '/reports/applied.xlsx' }, raw: {} }
function content(canGenerate = true, callerKey = 'user1') {
  return <MantineProvider env="test"><OneCTurnoverResponsiblesPanel scope={organizationOnlyScope} canGenerate={canGenerate} callerKey={callerKey} onClose={vi.fn()} /></MantineProvider>
}
describe('published organization-only turnover form', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(createStockReport).mockResolvedValue(file) })
  it('submits only the exact v3 scope and responsible net/gross layout', async () => {
    render(content())
    expect(screen.queryByRole('combobox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й сформувати' }))
    await screen.findByRole('dialog', { name: 'Продажі за відповідальними: 2026-10-01 — 2026-10-24' })
    const body = vi.mocked(createStockReport).mock.calls[0][0]
    expect(body).toMatchObject({ dataSource: 1, oneC: organizationOnlyScope.Filters, from: '2026-10-01', to: '2026-10-24', selections: [] })
    expect(body.sorted.Row.map(item => item.key)).toEqual(['Organization', 'SourceSaleResponsible'])
    expect(body.sorted.Col.map(item => item.key)).toEqual(['SourceOrderResponsible'])
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual([2, 4])
    expect(screen.getByText(/Дані з 1С станом на/).textContent).toContain('за Києвом')
    expect(screen.queryByText(/У доступному періоді є пропуски/)).toBeNull()
  })
  it('retains the applied file when the date draft becomes invalid and when a subsequent request has missing coverage', async () => {
    render(content())
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й сформувати' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Закрити файл' }))
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-01' } })
    expect((screen.getByRole('button', { name: 'Застосувати й сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Є незастосовані зміни/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити сформований звіт' }))
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toContain('2026-10-01 — 2026-10-24')
    expect(screen.getByRole('link', { name: 'Excel' }).getAttribute('href')).toBe('/reports/applied.xlsx')
    fireEvent.click(screen.getByRole('button', { name: 'Закрити файл' }))
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-10-02' } })
    vi.mocked(createStockReport).mockRejectedValueOnce(new ApiError('Період ще не завантажено повністю.', 409, null))
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й сформувати' }))
    await screen.findByText('Період ще не завантажено повністю.')
    expect(screen.getByLabelText('Період сформованого звіту').textContent).toContain('2026-10-01 — 2026-10-24')
  })
  it('invalidates results and ignores late completion after caller or permission changes', async () => {
    let complete!: (result: ReportResult) => void
    vi.mocked(createStockReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const { rerender } = render(content())
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й сформувати' }))
    rerender(content(false))
    await act(async () => { complete(file) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Відкрити сформований звіт' })).toBeNull()
    rerender(content(true, 'user2'))
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й сформувати' }))
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    await screen.findByRole('dialog')
    rerender(content(true, 'user3'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('keeps the unfinished-period warning after the calendar advances beyond the captured month', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T10:00:00Z'))
    try {
      render(<MantineProvider env="test"><OneCTurnoverResponsiblesPanel scope={{ ...organizationOnlyScope, LastDay: '2026-10-31', LoadedDayCount: 61 }} canGenerate callerKey="u1" onClose={vi.fn()} /></MantineProvider>)
      expect(screen.getByText('Знімок отримано до завершення вибраного періоду. Дані за цей період ще не остаточні.')).toBeTruthy()
    } finally { vi.useRealTimers() }
  })

  it('shows a gap notice only when published day count proves missing days', () => {
    render(<MantineProvider env="test"><OneCTurnoverResponsiblesPanel scope={{ ...organizationOnlyScope, LoadedDayCount: 2 }} canGenerate callerKey="u1" onClose={vi.fn()} /></MantineProvider>)
    expect(screen.getByText(/У доступному періоді є пропуски/)).toBeTruthy()
  })

  it('removes the old file on an authoritative permission denial', async () => {
    render(content())
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й сформувати' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Закрити файл' }))
    vi.mocked(createStockReport).mockRejectedValueOnce(new ApiError('Недостатньо прав.', 403, null))
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й сформувати' }))
    await screen.findByText('Недостатньо прав.')
    expect(screen.queryByRole('button', { name: 'Відкрити сформований звіт' })).toBeNull()
  })

  it('rejects outside coverage and more than31 days without making a request', () => {
    render(content())
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-10-25' } })
    expect(screen.getByText(/Період виходить за межі/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-01' } })
    expect(screen.getByText(/від 1 до 31 дня/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й сформувати' }))
    expect(createStockReport).not.toHaveBeenCalled()
  })
})
