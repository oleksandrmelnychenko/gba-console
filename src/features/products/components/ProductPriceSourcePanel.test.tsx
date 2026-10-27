import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'

const getProductSourcePriceComparison = vi.fn()

vi.mock('../api/productsApi', () => ({
  getProductSourcePriceComparison: (...args: unknown[]) => getProductSourcePriceComparison(...args),
}))

import { ProductPriceSourcePanel } from './ProductPriceSourcePanel'

afterEach(() => {
  getProductSourcePriceComparison.mockReset()
})

describe('ProductPriceSourcePanel', () => {
  it('shows only the AMG and Контех tabs and opens on AMG', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 1.7514, PricingName: 'ЦО1' }],
      },
      Fenix: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 2.002, PricingName: 'ЦО1' }],
      },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-1',
    })

    const view = renderPanel('product-source-panel-1')

    await waitFor(() => {
      expect(getProductSourcePriceComparison).toHaveBeenCalledWith(
        'product-source-panel-1',
        expect.any(AbortSignal),
      )
    })
    expect(await view.findByText('1,75')).toBeTruthy()
    expect(view.getByRole('radio', { name: 'AMG' })).toBeTruthy()
    expect(view.getByRole('radio', { name: 'Контех' })).toBeTruthy()
    expect(view.queryByRole('radio', { name: 'Порівняти' })).toBeNull()
  })

  it('switches between the AMG and Контех sources', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 1.4, PricingName: 'ЦО2' }],
      },
      Fenix: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 1.54, PricingName: 'ЦО2' }],
      },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-2',
    })

    const view = renderPanel('product-source-panel-2')

    expect(await view.findByText('1,40')).toBeTruthy()
    fireEvent.click(view.getByRole('radio', { name: 'Контех' }))
    expect(await view.findByText('1,54')).toBeTruthy()
  })

  it('loads fresh prices when the page refresh generation changes', async () => {
    const productNetId = 'product-source-panel-refresh'
    getProductSourcePriceComparison.mockResolvedValue({
      ProductNetId: productNetId,
      Amg: { IsAvailable: true, IsLinked: true, Prices: [{ PriceEur: 10, PricingName: 'ЦО2' }] },
      Fenix: { IsAvailable: true, IsLinked: true, Prices: [] },
    })
    const firstView = renderPanel(productNetId)
    await firstView.findByText('10,00')
    firstView.unmount()
    getProductSourcePriceComparison.mockResolvedValue({
      ProductNetId: productNetId,
      Amg: { IsAvailable: true, IsLinked: true, Prices: [{ PriceEur: 12, PricingName: 'ЦО2' }] },
      Fenix: { IsAvailable: true, IsLinked: true, Prices: [] },
    })
    const refreshedView = renderPanel(productNetId, 1)
    await refreshedView.findByText('12,00')
    expect(getProductSourcePriceComparison).toHaveBeenCalledTimes(2)
  })

  it('retries a failed source read in place without duplicate requests', async () => {
    getProductSourcePriceComparison.mockRejectedValueOnce(new Error('Source offline'))
    const view = renderPanel('source-retry-ui')
    await view.findByText('Source offline')
    let finish!: (value: unknown) => void
    getProductSourcePriceComparison.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const retry = view.getByRole('button', { name: 'Повторити завантаження цін' })
    fireEvent.click(retry)
    fireEvent.click(retry)
    expect(getProductSourcePriceComparison).toHaveBeenCalledTimes(2)
    expect(view.getByRole('alert').textContent).toContain('Source offline')
    await act(async () => finish({ ProductNetId: 'source-retry-ui', Amg: { IsAvailable: true, IsLinked: true, Prices: [{ PriceEur: 18, PricingName: 'ЦР' }] } }))
    expect(view.getByText('18,00')).toBeTruthy()
    expect(view.queryByRole('alert')).toBeNull()
  })

  it('refreshes in place while retaining the selected source tab', async () => {
    const id = 'source-tab-refresh'
    const comparison = { ProductNetId: id, Amg: { IsAvailable: true, IsLinked: true, Prices: [{ PriceEur: 1, PricingName: 'ЦР' }] },
      Fenix: { IsAvailable: true, IsLinked: true, Prices: [{ PriceEur: 2, PricingName: 'ЦР' }] } }
    getProductSourcePriceComparison.mockResolvedValueOnce(comparison)
    const view = renderPanel(id)
    await view.findByText('1,00')
    fireEvent.click(view.getByRole('radio', { name: 'Контех' }))
    expect(view.getByText('2,00')).toBeTruthy()
    getProductSourcePriceComparison.mockResolvedValueOnce({ ...comparison, Fenix: { ...comparison.Fenix, Prices: [{ PriceEur: 3, PricingName: 'ЦР' }] } })
    view.rerender(panel(id, 1))
    await view.findByText('3,00')
    expect((view.getByRole('radio', { name: 'Контех' }) as HTMLInputElement).checked).toBe(true)
    expect(getProductSourcePriceComparison).toHaveBeenCalledTimes(2)
  })

  it('omits sync timestamps for both price sources', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 1.4, PricingName: 'ЦО2' }],
        SyncedAtUtc: '2026-10-19T12:04:43.9337367',
      },
      Fenix: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 1.54, PricingName: 'ЦО2' }],
        SyncedAtUtc: '2026-10-19T12:41:05.1109628',
      },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-synced',
    })

    const view = renderPanel('product-source-panel-synced')

    await view.findByText('1,40')
    expect(view.queryByText(/Дані синку від/)).toBeNull()
    fireEvent.click(view.getByRole('radio', { name: 'Контех' }))
    await view.findByText('1,54')
    expect(view.queryByText(/Дані синку від/)).toBeNull()
  })

  it('omits the sync line when the source has no sync time', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: { IsAvailable: true, IsLinked: true, Prices: [{ PriceEur: 2, PricingName: 'ЦО2' }] },
      Fenix: { IsAvailable: true, IsLinked: true, Prices: [] },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-unsynced',
    })

    const view = renderPanel('product-source-panel-unsynced')

    await view.findByText('2,00')
    expect(view.queryByText(/Дані синку від/)).toBeNull()
  })

  it('orders prices as base/VAT pairs following the effective price order', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [
          { PriceEur: 6, PricingName: 'ЦО2 (НДС)' },
          { PriceEur: 1, PricingName: 'ЦР' },
          { PriceEur: 3, PricingName: 'ЦО1' },
          { PriceEur: 2, PricingName: 'ЦР (НДС)' },
          { PriceEur: 5, PricingName: 'ЦО2' },
          { PriceEur: 4, PricingName: 'ЦО1 (НДС)' },
        ],
      },
      Fenix: { IsAvailable: true, IsLinked: true, Prices: [] },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-3',
    })

    const view = renderPanel('product-source-panel-3')

    await view.findByText('ЦР')
    const rows = Array.from(view.container.querySelectorAll('.product-inline-price-row'))
      .map((row) => row.querySelector('p')?.textContent?.trim() || '')

    expect(rows).toEqual([
      'ЦР',
      'ЦР (НДС)',
      'ЦО1',
      'ЦО1 (НДС)',
      'ЦО2',
      'ЦО2 (НДС)',
    ])
  })

  it('shows a GBA product its own prices instead of the unlinked notice', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: {
        IsAvailable: true,
        IsLinked: true,
        IsNative: true,
        Prices: [
          { Owner: 'gba', PriceEur: 7, PricingName: 'ЦР' },
          { FromOtherWorld: true, Owner: '1c', PriceEur: 9, PricingName: 'ЦО1' },
        ],
      },
      Fenix: { IsAvailable: true, IsLinked: true, IsNative: true, Prices: [] },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-native',
    })

    const view = renderPanel('product-source-panel-native')

    expect(await view.findByText('7,00')).toBeTruthy()
    expect(view.queryByText('Товар не прив’язаний до джерела')).toBeNull()
    expect(view.getByText('GBA')).toBeTruthy()
    expect(view.getByText('1С')).toBeTruthy()
    expect(view.getByText('з Контех')).toBeTruthy()
    fireEvent.click(view.getByRole('radio', { name: 'Контех' }))
    expect(await view.findByText('Ціни ще не задано')).toBeTruthy()
  })

  it('keeps the unlinked notice for an older server without native sets', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: { IsAvailable: false, IsLinked: false },
      Fenix: { IsAvailable: false, IsLinked: false },
      ProductNetId: 'product-source-panel-unlinked',
    })

    const view = renderPanel('product-source-panel-unlinked')

    expect(await view.findByText('Товар не прив’язаний до джерела')).toBeTruthy()
  })
})

function renderPanel(productNetId: string, refreshKey = 0) {
  return render(panel(productNetId, refreshKey))
}

function panel(productNetId: string, refreshKey = 0) {
  return (
    <MantineProvider theme={theme}>
      <I18nProvider>
        <ProductPriceSourcePanel
          effectivePrices={[
            { Pricing: { Name: 'ЦР' }, RetailPriceEUR: 1, RetailPriceLocal: 42 },
            { Pricing: { Name: 'ЦО1' }, RetailPriceEUR: 1.2, RetailPriceLocal: 50 },
            { Pricing: { Name: 'ЦО2' }, RetailPriceEUR: 1.4, RetailPriceLocal: 71.61 },
          ]}
          productNetId={productNetId}
          refreshKey={refreshKey}
        />
      </I18nProvider>
    </MantineProvider>
  )
}
