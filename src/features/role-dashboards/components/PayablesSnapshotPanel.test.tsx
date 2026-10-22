import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { renderWithMantine } from '../../../test/renderWithMantine'
import { getPayablesRows, getPayablesSnapshot } from '../api/dashboardPayablesApi'
import { payablesRows, payablesSnapshot, payablesWorld } from '../payablesTestData'
import { PayablesSnapshotPanel } from './PayablesSnapshotPanel'
import { PayablesRowsModal } from './PayablesRowsModal'

vi.mock('../api/dashboardPayablesApi', () => ({ getPayablesSnapshot: vi.fn(), getPayablesRows: vi.fn() }))

function renderPanel() {
  return renderWithMantine(<I18nProvider><PayablesSnapshotPanel workspace="finance" /></I18nProvider>)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getPayablesSnapshot).mockResolvedValue(payablesSnapshot())
  vi.mocked(getPayablesRows).mockResolvedValue(payablesRows())
})

describe('payables source presentation', () => {
  it('shows unavailable AMG without fabricated zero and Fenix liability without netting the advance', async () => {
    renderPanel()
    const fenix = await screen.findByTestId('payables-world-fenix')
    expect(within(fenix).getByText('100,00')).toBeTruthy()
    expect(within(fenix).getByText('20,00')).toBeTruthy()
    expect(within(fenix).getByText('Свіжість після цього зрізу не підтверджена.')).toBeTruthy()
    expect(within(fenix).getByText(/Станом на/).textContent).toContain('03:00')
    const amg = screen.getByTestId('payables-world-amg')
    expect(within(amg).getByText('Валюту боргу не підтверджено')).toBeTruthy()
    expect(within(amg).queryByText('0,00')).toBeNull()
    expect(within(amg).queryByRole('button', { name: /Розшифровка/ })).toBeNull()
    expect(screen.getByText(/Обраний період продажів на нього не впливає/)).toBeTruthy()
  })

  it('distinguishes source movements, verified empty replies and excluded source scope', async () => {
    const data = payablesSnapshot()
    data.worlds[0] = payablesWorld({ requestedKeys: 4, returnedKeys: 2, excludedKeys: 3 })
    vi.mocked(getPayablesSnapshot).mockResolvedValue(data)
    renderPanel()
    await screen.findByText('З рухом у джерелі: 2')
    expect(screen.getByText(/Підтверджених порожніх відповідей: 2/)).toBeTruthy()
    expect(screen.getByText(/Поза обсягом цього джерела: 3/)).toBeTruthy()
  })

  it('keeps worlds and source currencies separate and opens only the selected immutable slice', async () => {
    const data = payablesSnapshot()
    data.worlds[0].buckets.push({ currencyCode: 'UAH', currencyLabel: 'Гривня', rowCount: 1, signedBalance: -500, payable: 500, advance: 0 })
    data.worlds[1] = payablesWorld({ world: 'amg', publicationId: 'b0000000-0000-0000-0000-000000000001', buckets: [{ currencyCode: 'USD', currencyLabel: 'USD', rowCount: 1, signedBalance: -900, payable: 900, advance: 0 }] })
    vi.mocked(getPayablesSnapshot).mockResolvedValue(data)
    renderPanel()
    const fenix = await screen.findByTestId('payables-world-fenix')
    expect(within(fenix).getByText('Гривня (UAH)')).toBeTruthy()
    expect(within(screen.getByTestId('payables-world-amg')).getByText('900,00')).toBeTruthy()
    fireEvent.click(within(fenix).getByRole('button', { name: 'Розшифровка · 2 записів' }))
    expect(await screen.findByText('Постачальник один')).toBeTruthy()
    expect(getPayablesRows).toHaveBeenCalledWith(expect.objectContaining({ workspace: 'finance', world: 'fenix', publicationId: data.worlds[0].publicationId, currencyCode: 'USD', offset: 0, limit: 50 }), expect.any(AbortSignal))
  })

  it('replaces previous confirmed values with an explicit refresh error and supports retry', async () => {
    vi.mocked(getPayablesSnapshot).mockResolvedValueOnce(payablesSnapshot()).mockRejectedValueOnce(new Error('Джерело недоступне')).mockResolvedValue(payablesSnapshot())
    renderPanel()
    await screen.findByTestId('payables-world-fenix')
    fireEvent.click(screen.getByRole('button', { name: 'Оновити відображення' }))
    await screen.findByText('Джерело недоступне')
    expect(screen.queryByTestId('payables-world-fenix')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Оновити відображення' }))
    await screen.findByTestId('payables-world-fenix')
    expect(screen.queryByText('Джерело недоступне')).toBeNull()
  })

  it('allows an explicitly scoped partial snapshot drilldown without implying all-source coverage', async () => {
    const data = payablesSnapshot()
    data.worlds[0].scopeComplete = false
    vi.mocked(getPayablesSnapshot).mockResolvedValue(data)
    renderPanel()
    await screen.findByText('Покриття зареєстрованих ключів неповне. Наведені суми охоплюють лише підтверджені записи.')
    fireEvent.click(screen.getByRole('button', { name: /Розшифровка/ }))
    await screen.findByText('Постачальник один')
    expect(screen.getByText('Покриття неповне; наведено лише підтверджену область.')).toBeTruthy()
  })

  it('does not display mismatched pinned-source aggregates as a valid drilldown', async () => {
    vi.mocked(getPayablesRows).mockResolvedValue({ ...payablesRows(), aggregate: { signedBalance: -81, payable: 101, advance: 20 } })
    const world = payablesWorld()
    renderWithMantine(<I18nProvider><PayablesRowsModal workspace="finance" selected={{ world, bucket: world.buckets[0] }} onClose={vi.fn()} /></I18nProvider>)
    await screen.findByText('Розшифровка не відповідає обраному зрізу або його підсумкам. Закрийте її та оновіть відображення.')
    expect(screen.queryByText('Постачальник один')).toBeNull()
  })

  it('pages the full source population with the same publication, world and currency', async () => {
    const world = payablesWorld()
    world.buckets[0].rowCount = 51
    vi.mocked(getPayablesRows).mockImplementation(async request => ({
      ...payablesRows(), offset: request.offset, total: 51,
      rows: Array.from({ length: request.offset === 0 ? 50 : 1 }, (_, index) => ({ ...payablesRows().rows[0], id: `row-${request.offset + index}`, supplierName: `Постачальник ${request.offset + index}` })),
    }))
    renderWithMantine(<I18nProvider><PayablesRowsModal workspace="executive" selected={{ world, bucket: world.buckets[0] }} onClose={vi.fn()} /></I18nProvider>)
    await screen.findByText('Постачальник 0')
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await screen.findByText('Постачальник 50')
    await waitFor(() => expect(getPayablesRows).toHaveBeenLastCalledWith({ workspace: 'executive', world: 'fenix', publicationId: world.publicationId, currencyCode: 'USD', offset: 50, limit: 50 }, expect.any(AbortSignal)))
  })
})
