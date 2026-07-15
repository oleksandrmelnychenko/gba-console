import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductUploadPricings, uploadProductsFromFile } from '../api/productsApi'
import {
  buildProductFileUploadConfiguration,
  createProductFileUploadForm,
} from '../productFileUpload'

vi.mock('../api/productsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/productsApi')>()

  return {
    ...actual,
    getProductUploadPricings: vi.fn(),
    uploadProductsFromFile: vi.fn(),
  }
})

import { ProductFileUploadModal } from './ProductsPage'

const getProductUploadPricingsMock = vi.mocked(getProductUploadPricings)
const uploadProductsFromFileMock = vi.mocked(uploadProductsFromFile)

beforeEach(() => {
  getProductUploadPricingsMock.mockReset()
  uploadProductsFromFileMock.mockReset()
  getProductUploadPricingsMock.mockResolvedValue([{ Id: 12, Name: 'ЦО2' }])
  uploadProductsFromFileMock.mockResolvedValue()
})

describe('ProductFileUploadModal price source', () => {
  it('requires an explicit source only after a price column is added', async () => {
    renderModal()

    expect(screen.queryByText('Джерело цін')).toBeNull()

    const addPriceButton = await screen.findByRole('button', { name: 'Додати ціну' })
    await waitFor(() => expect((addPriceButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(addPriceButton)

    expect(screen.getByText('Джерело цін')).toBeTruthy()
    expect(screen.getByText('Оберіть джерело цін перед завантаженням')).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Контех (Fenix)' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('radio', { name: 'AMG' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('button', { name: 'Завантажити' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('accepts an explicit source selection and clears the validation hint', async () => {
    renderModal()

    const addPriceButton = await screen.findByRole('button', { name: 'Додати ціну' })
    await waitFor(() => expect((addPriceButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(addPriceButton)
    fireEvent.click(screen.getByRole('radio', { name: 'AMG' }))

    expect((screen.getByRole('radio', { name: 'AMG' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByText('Оберіть джерело цін перед завантаженням')).toBeNull()
  })

  it('serializes the selected source only for priced form rows', () => {
    const baseForm = createProductFileUploadForm()
    const pricedConfiguration = buildProductFileUploadConfiguration({
      ...baseForm,
      priceSourceIsAmg: true,
      prices: [{ columnNumber: 4, key: 'price-1', pricingId: '12' }],
    })
    const fenixConfiguration = buildProductFileUploadConfiguration({
      ...baseForm,
      priceSourceIsAmg: false,
      prices: [{ columnNumber: 6, key: 'price-2', pricingId: '15' }],
    })
    const unpricedConfiguration = buildProductFileUploadConfiguration({
      ...baseForm,
      priceSourceIsAmg: false,
    })

    expect(pricedConfiguration).toMatchObject({
      ImportedForAmg: true,
      PriceConfigurations: [{ ColumnNumber: 4, PricingId: 12 }],
      WithPrices: true,
    })
    expect(fenixConfiguration).toMatchObject({
      ImportedForAmg: false,
      PriceConfigurations: [{ ColumnNumber: 6, PricingId: 15 }],
      WithPrices: true,
    })
    expect(unpricedConfiguration.WithPrices).toBe(false)
    expect(unpricedConfiguration).not.toHaveProperty('ImportedForAmg')
  })
})

function renderModal() {
  render(
    <MantineProvider>
      <I18nProvider>
        <ProductFileUploadModal
          opened
          onClose={vi.fn()}
          onUploadSuccess={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}
