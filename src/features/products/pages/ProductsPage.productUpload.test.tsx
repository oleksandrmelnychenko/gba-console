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
    expect((screen.getByRole('radio', { name: 'Обидва світи' }) as HTMLInputElement).checked).toBe(false)
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

  it('explains that both worlds price new products in Контех and AMG', async () => {
    renderModal()

    const addPriceButton = await screen.findByRole('button', { name: 'Додати ціну' })
    await waitFor(() => expect((addPriceButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(addPriceButton)
    fireEvent.click(screen.getByRole('radio', { name: 'Обидва світи' }))

    expect((screen.getByRole('radio', { name: 'Обидва світи' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Нові товари без коду 1С отримають ціну в Контех і AMG; товари з кодом 1С — у своєму світі.')).toBeTruthy()
  })

  it('serializes the selected source only for priced form rows', () => {
    const baseForm = createProductFileUploadForm()
    const pricedConfiguration = buildProductFileUploadConfiguration({
      ...baseForm,
      priceSource: 'amg',
      prices: [{ columnNumber: 4, key: 'price-1', pricingId: '12' }],
    })
    const fenixConfiguration = buildProductFileUploadConfiguration({
      ...baseForm,
      priceSource: 'fenix',
      prices: [{ columnNumber: 6, key: 'price-2', pricingId: '15' }],
    })
    const bothConfiguration = buildProductFileUploadConfiguration({
      ...baseForm,
      priceSource: 'both',
      prices: [{ columnNumber: 8, key: 'price-3', pricingId: '17' }],
    })
    const unpricedConfiguration = buildProductFileUploadConfiguration({
      ...baseForm,
      priceSource: 'fenix',
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
    expect(bothConfiguration).toMatchObject({
      ImportedForBothWorlds: true,
      PriceConfigurations: [{ ColumnNumber: 8, PricingId: 17 }],
      WithPrices: true,
    })
    expect(bothConfiguration).not.toHaveProperty('ImportedForAmg')
    expect(unpricedConfiguration.WithPrices).toBe(false)
    expect(unpricedConfiguration).not.toHaveProperty('ImportedForAmg')
    expect(unpricedConfiguration).not.toHaveProperty('ImportedForBothWorlds')
  })
})

describe('ProductFileUploadModal goods or service choice', () => {
  it('requires an explicit choice with no default before adding products', async () => {
    renderModal()

    expect(await screen.findByText('Тип позиції')).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Товар' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('radio', { name: 'Послуга' }) as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByRole('radio', { name: 'Не визначено' })).toBeNull()
    expect(screen.getByText('Оберіть, нові позиції з файлу — товари чи послуги')).toBeTruthy()
    fillRequiredUploadFields()
    expect((screen.getByRole('button', { name: 'Завантажити' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: 'Послуга' }))

    expect(screen.queryByText('Оберіть, нові позиції з файлу — товари чи послуги')).toBeNull()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Завантажити' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Завантажити' }))
    await waitFor(() => expect(uploadProductsFromFileMock).toHaveBeenCalledTimes(1))
    expect(uploadProductsFromFileMock.mock.calls[0][0]).toMatchObject({ Mode: 0, NativeIsService: true })
  })

  it('serializes the choice only for the add operation', () => {
    const baseForm = createProductFileUploadForm()

    expect(baseForm.nativeIsService).toBeNull()
    expect(buildProductFileUploadConfiguration({ ...baseForm, nativeIsService: false }))
      .toMatchObject({ Mode: 0, NativeIsService: false })
    expect(buildProductFileUploadConfiguration({ ...baseForm, mode: 1, nativeIsService: true }))
      .not.toHaveProperty('NativeIsService')
  })
})

function fillRequiredUploadFields() {
  fireEvent.change(screen.getByRole('textbox', { name: /^З(\s|\*|$)/ }), { target: { value: '2' } })
  fireEvent.change(screen.getByRole('textbox', { name: /^По(\s|\*|$)/ }), { target: { value: '3' } })
  fireEvent.change(screen.getByRole('textbox', { name: /^Код виробника(\s|\*|$)/ }), { target: { value: '1' } })
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [new File(['vendor'], 'products.xlsx')] } })
}

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
