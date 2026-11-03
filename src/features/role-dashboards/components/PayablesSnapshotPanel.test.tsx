import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { renderWithMantine } from '../../../test/renderWithMantine'
import { getPayablesRows, getPayablesSnapshot } from '../api/dashboardPayablesApi'
import { payablesBucket, payablesRows, scopedPayablesSnapshot, scopedPayablesRows } from '../payablesTestData'
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
  vi.mocked(getPayablesSnapshot).mockImplementation(async (_workspace, _signal, kind) => scopedPayablesSnapshot(kind ?? 2))
  vi.mocked(getPayablesRows).mockImplementation(async request => request.partyKind ? scopedPayablesRows(request.partyKind) : payablesRows())
})

describe('payables from GBA supplier documents', () => {
  it('separates goods suppliers from services and other settlements without netting or a mixed total', async () => {
    renderPanel()
    const goods = await screen.findByTestId('payables-currency-2-USD')
    const other = await screen.findByTestId('payables-currency-3-USD')
    expect(within(goods).getByText('100,00')).toBeTruthy()
    expect(within(goods).queryByText('20,00')).toBeNull()
    expect(within(other).getAllByText('20,00')).toHaveLength(2)
    expect(within(other).queryByText('100,00')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Постачальники товарів' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Послуги та інші розрахунки' })).toBeTruthy()
    expect(screen.queryByText('-80,00')).toBeNull()
    expect(screen.getAllByText(/Станом на кінець дня/)).toHaveLength(2)
    expect(screen.getAllByText(/з датою «з» 03.11.2026/)).toHaveLength(2)
    expect(screen.queryByText(/Fenix|AMG|1С/)).toBeNull()
    expect(getPayablesSnapshot).toHaveBeenCalledWith('finance', expect.any(AbortSignal), 2)
    expect(getPayablesSnapshot).toHaveBeenCalledWith('finance', expect.any(AbortSignal), 3)
  })

  it('keeps currencies separate and warns about unconfirmed amounts only in the affected category', async () => {
    const data = scopedPayablesSnapshot(2)
    data.buckets.push(payablesBucket({ currencyCode: 'UAH', rowCount: 3, goodsRowCount: 3, serviceRowCount: 0, unknownRowCount: 1, signedBalance: -500, payable: 500, advance: 0 }))
    vi.mocked(getPayablesSnapshot).mockImplementation(async (_workspace, _signal, kind) => kind === 2 ? data : scopedPayablesSnapshot(3))
    renderPanel()
    const uah = await screen.findByTestId('payables-currency-2-UAH')
    expect(within(uah).getByText('500,00')).toBeTruthy()
    expect(within(uah).getByText(/Договорів без підтвердженої суми приходу: 1/)).toBeTruthy()
    expect(within(screen.getByTestId('payables-currency-3-USD')).queryByText(/без підтвердженої/)).toBeNull()
  })

  it('opens each drilldown for the same category, day and currency with the correct settlement link', async () => {
    renderPanel()
    fireEvent.click(within(await screen.findByTestId('payables-currency-2-USD')).getByRole('button', { name: /Розшифровка/ }))
    expect((await screen.findByText('Постачальник один')).closest('a')?.getAttribute('href')).toBe('/suppliers/accounting-cash-flow/a0000000-0000-0000-0000-000000000011')
    expect(screen.queryByText('Перевізник два')).toBeNull()
    expect(getPayablesRows).toHaveBeenCalledWith({ workspace: 'finance', partyKind: 2, asOfDate: '2026-11-02', currencyCode: 'USD', offset: 0, limit: 50 }, expect.any(AbortSignal))
    fireEvent.click(screen.getByRole('button', { name: 'Закрити розшифровку' }))
    fireEvent.click(within(screen.getByTestId('payables-currency-3-USD')).getByRole('button', { name: /Розшифровка/ }))
    expect((await screen.findByText('Перевізник два')).closest('a')?.getAttribute('href')).toBe('/accounting/supplier-organizations/cash-flow/a0000000-0000-0000-0000-000000000012')
    expect(getPayablesRows).toHaveBeenLastCalledWith({ workspace: 'finance', partyKind: 3, asOfDate: '2026-11-02', currencyCode: 'USD', offset: 0, limit: 50 }, expect.any(AbortSignal))
  })

  it('clears failed refreshed amounts while the other category stays independently available', async () => {
    let goodsCalls = 0
    vi.mocked(getPayablesSnapshot).mockImplementation(async (_workspace, _signal, kind) => {
      if (kind === 2 && ++goodsCalls === 2) throw new Error('Джерело недоступне')
      return scopedPayablesSnapshot(kind ?? 2)
    })
    renderPanel()
    await screen.findByTestId('payables-currency-2-USD')
    const goods = screen.getByTestId('payables-snapshot-panel-2')
    fireEvent.click(within(goods).getByRole('button', { name: 'Оновити відображення' }))
    await screen.findByText('Джерело недоступне')
    expect(screen.queryByTestId('payables-currency-2-USD')).toBeNull()
    expect(screen.getByTestId('payables-currency-3-USD')).toBeTruthy()
    fireEvent.click(within(goods).getByRole('button', { name: 'Оновити відображення' }))
    await screen.findByTestId('payables-currency-2-USD')
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
