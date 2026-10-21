import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../api/apiClient'
import { I18nProvider } from '../../i18n/I18nProvider'
import { ProductSourceHistoryRefresh, type ProductSourceHistoryStatus } from './ProductSourceHistoryRefresh'

vi.mock('../../api/apiClient', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
const status = (State: ProductSourceHistoryStatus['State']): ProductSourceHistoryStatus => ({
  Enabled: State !== 'disabled', State,
  Products: [{ ProductNetId: 'product', State, Error: State === 'partial' ? 'AMG недоступний' : null,
    Sources: [{ SourceSystem: 'Fenix', RowCount: 87, RefreshedAtUtc: '2026-10-21T07:00:00Z' }] }],
})
const flush = async () => { await act(async () => { await Promise.resolve() }) }
const wrap = (id: string, onRefreshed: () => void, includeSiblings = false) => (
  <MantineProvider><I18nProvider>
    <ProductSourceHistoryRefresh productNetId={id} includeSiblings={includeSiblings} onRefreshed={onRefreshed} />
  </I18nProvider></MantineProvider>
)

beforeEach(() => { vi.useFakeTimers(); request.mockReset() })
afterEach(() => { vi.useRealTimers() })

describe('product source history refresh', () => {
  it('starts once, polls background work and reloads current rows only on completion', async () => {
    request.mockResolvedValueOnce(status('queued')).mockResolvedValueOnce(status('running')).mockResolvedValueOnce(status('ready'))
    const reload = vi.fn()
    render(wrap('product', reload, true))
    await flush()
    expect(request).toHaveBeenNthCalledWith(1, expect.stringContaining('/history/refresh'), expect.objectContaining({
      method: 'POST', query: { productNetId: 'product', includeSiblings: true, force: false },
    }))
    expect(reload).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(reload).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(reload).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenLastCalledWith(expect.stringContaining('/history/status'), expect.objectContaining({ method: 'GET' }))
    expect(screen.getByRole('status').textContent).toContain('Історію 1С оновлено')
    expect(screen.getByRole('status').textContent).toContain('Дані від')
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('shows partial status, keeps saved data available and allows explicit force refresh', async () => {
    request.mockResolvedValueOnce(status('partial')).mockResolvedValueOnce(status('ready'))
    const reload = vi.fn()
    render(wrap('product', reload))
    await flush()
    expect(screen.getByRole('status').textContent).toContain('частково')
    expect(screen.getByRole('alert').textContent).toContain('AMG недоступний')
    expect(reload).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Оновити історію 1С' }))
    await flush()
    expect(request).toHaveBeenLastCalledWith(expect.stringContaining('/history/refresh'), expect.objectContaining({ query: {
      productNetId: 'product', includeSiblings: false, force: true,
    } }))
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('aborts old requests on product changes and unmount; stale completion cannot reload a new product', async () => {
    let complete!: (value: ProductSourceHistoryStatus) => void
    request.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
      .mockResolvedValueOnce(status('queued'))
    const reload = vi.fn()
    const view = render(wrap('old-product', reload))
    const signal = request.mock.calls[0][1]!.signal!
    view.rerender(wrap('new-product', reload))
    await flush()
    expect(signal.aborted).toBe(true)
    await act(async () => complete(status('ready')))
    expect(reload).not.toHaveBeenCalled()
    const latestSignal = request.mock.calls[1][1]!.signal!
    view.unmount()
    expect(latestSignal.aborted).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('explains missing source bindings without claiming a refresh or offering a force button', async () => {
    request.mockResolvedValueOnce({ Enabled: true, State: 'ready', Products: [
      { ProductNetId: 'product', State: 'ready', Sources: [] },
    ] })
    render(wrap('product', vi.fn()))
    await flush()
    expect(screen.getByRole('status').textContent).toBe('Товар не має прив’язки до 1С')
    expect(screen.queryByRole('button', { name: 'Оновити історію 1С' })).toBeNull()
    expect(screen.queryByText('Історію 1С оновлено')).toBeNull()
  })

  it('does not report a disabled or failed history as complete', async () => {
    request.mockResolvedValueOnce(status('disabled'))
    const reload = vi.fn()
    const view = render(wrap('product', reload))
    await flush()
    expect(screen.getByRole('status').textContent).toContain('збережені дані')
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    expect(reload).not.toHaveBeenCalled()
    view.unmount()
    request.mockRejectedValueOnce(new Error('Network failed'))
    render(wrap('other', reload))
    await flush()
    expect(screen.getByRole('alert').textContent).toContain('Network failed')
    expect(reload).not.toHaveBeenCalled()
  })
})
