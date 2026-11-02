import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { renderWithMantine } from '../../../test/renderWithMantine'
import { getPayablesRows, getPayablesSnapshot } from '../api/dashboardPayablesApi'
import { payablesBucket, payablesRows, payablesSnapshot } from '../payablesTestData'
import { PayablesSnapshotPanel } from './PayablesSnapshotPanel'
import { PayablesRowsModal } from './PayablesRowsModal'

vi.mock('../api/dashboardPayablesApi', () => ({ getPayablesSnapshot: vi.fn(), getPayablesRows: vi.fn() }))

function renderPanel() {
  return renderWithMantine(<MemoryRouter><I18nProvider><PayablesSnapshotPanel workspace="finance" /></I18nProvider></MemoryRouter>)
}

function renderModal(selected = { asOfDate: '2026-11-02', bucket: payablesBucket() }, workspace: 'finance' | 'executive' = 'finance') {
  return renderWithMantine(<MemoryRouter><I18nProvider><PayablesRowsModal workspace={workspace} selected={selected} onClose={vi.fn()} /></I18nProvider></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getPayablesSnapshot).mockResolvedValue(payablesSnapshot())
  vi.mocked(getPayablesRows).mockResolvedValue(payablesRows())
})

describe('payables from GBA supplier documents', () => {
  it('shows the business day, debt and advances without netting and without any 1C world switch', async () => {
    renderPanel()
    const usd = await screen.findByTestId('payables-currency-USD')
    expect(within(usd).getByText('100,00')).toBeTruthy()
    expect(within(usd).getByText('20,00')).toBeTruthy()
    expect(screen.getByText(/Станом на кінець дня/).textContent).toContain('02.11.2026')
    expect(screen.getByText(/з датою «з» 03.11.2026/)).toBeTruthy()
    expect(screen.queryByText(/Fenix|AMG|1С/)).toBeNull()
  })

  it('keeps currencies separate and warns about agreements whose receipt amount is unconfirmed', async () => {
    const data = payablesSnapshot()
    data.buckets.push(payablesBucket({ currencyCode: 'UAH', rowCount: 3, goodsRowCount: 3, serviceRowCount: 0, unknownRowCount: 1, signedBalance: -500, payable: 500, advance: 0 }))
    vi.mocked(getPayablesSnapshot).mockResolvedValue(data)
    renderPanel()
    const uah = await screen.findByTestId('payables-currency-UAH')
    expect(within(uah).getByText('500,00')).toBeTruthy()
    expect(within(uah).getByText(/Договорів без підтвердженої суми приходу: 1/)).toBeTruthy()
    expect(within(screen.getByTestId('payables-currency-USD')).queryByText(/без підтвердженої/)).toBeNull()
  })

  it('opens the drilldown for the same day and currency and links each row to its settlement grid', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Розшифровка · 2 договорів' }))
    const link = (await screen.findByText('Постачальник один')).closest('a')
    expect(link?.getAttribute('href')).toBe('/suppliers/accounting-cash-flow/a0000000-0000-0000-0000-000000000011')
    expect(screen.getByText('Перевізник два').closest('a')?.getAttribute('href')).toBe('/accounting/supplier-organizations/cash-flow/a0000000-0000-0000-0000-000000000012')
    expect(getPayablesRows).toHaveBeenCalledWith({ workspace: 'finance', asOfDate: '2026-11-02', currencyCode: 'USD', offset: 0, limit: 50 }, expect.any(AbortSignal))
  })

  it('replaces previous values with an explicit refresh error and supports retry', async () => {
    vi.mocked(getPayablesSnapshot).mockResolvedValueOnce(payablesSnapshot()).mockRejectedValueOnce(new Error('Джерело недоступне')).mockResolvedValue(payablesSnapshot())
    renderPanel()
    await screen.findByTestId('payables-currency-USD')
    fireEvent.click(screen.getByRole('button', { name: 'Оновити відображення' }))
    await screen.findByText('Джерело недоступне')
    expect(screen.queryByTestId('payables-currency-USD')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Оновити відображення' }))
    await screen.findByTestId('payables-currency-USD')
    expect(screen.queryByText('Джерело недоступне')).toBeNull()
  })

  it('does not display a drilldown whose aggregate differs from the tile', async () => {
    vi.mocked(getPayablesRows).mockResolvedValue({ ...payablesRows(), aggregate: { signedBalance: -81, payable: 101, advance: 20 } })
    renderModal()
    await screen.findByText('Розшифровка не відповідає підсумкам панелі. Закрийте її та оновіть відображення.')
    expect(screen.queryByText('Постачальник один')).toBeNull()
  })

  it('marks an unconfirmed agreement instead of showing it as zero', async () => {
    const rows = payablesRows()
    rows.rows[1] = { ...rows.rows[1], known: false, signedBalance: 0, payable: 0, advance: 0 }
    rows.aggregate = { signedBalance: -100, payable: 100, advance: 0 }
    vi.mocked(getPayablesRows).mockResolvedValue(rows)
    renderModal({ asOfDate: '2026-11-02', bucket: payablesBucket({ unknownRowCount: 1, signedBalance: -100, payable: 100, advance: 0 }) })
    expect(await screen.findByText('Сума приходу не підтверджена')).toBeTruthy()
  })

  it('pages the full population with the same day and currency', async () => {
    vi.mocked(getPayablesRows).mockImplementation(async request => ({
      ...payablesRows(), offset: request.offset, total: 51,
      rows: Array.from({ length: request.offset === 0 ? 50 : 1 }, (_, index) => ({ ...payablesRows().rows[0], id: `row-${request.offset + index}`, supplierName: `Постачальник ${request.offset + index}` })),
    }))
    renderModal({ asOfDate: '2026-11-02', bucket: payablesBucket({ rowCount: 51, goodsRowCount: 50 }) }, 'executive')
    await screen.findByText('Постачальник 0')
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await screen.findByText('Постачальник 50')
    await waitFor(() => expect(getPayablesRows).toHaveBeenLastCalledWith({ workspace: 'executive', asOfDate: '2026-11-02', currencyCode: 'USD', offset: 50, limit: 50 }, expect.any(AbortSignal)))
  })
})
