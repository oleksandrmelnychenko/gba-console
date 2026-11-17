import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductUploadPricings, uploadProductsFromFile } from '../api/productsApi'
import {
  buildProductFileUploadConfiguration,
  countProductFileUploadRows,
  createProductFileUploadForm,
  normalizeProductFileUploadResult,
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
  uploadProductsFromFileMock.mockResolvedValue(null)
  // Mantine's Select scrolls the active option into view; jsdom has no layout.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
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

describe('ProductFileUploadModal operation result', () => {
  it('asks before sending a delete file, names the row count, and sends nothing when declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderModal()
    await chooseOperation('Видалити')
    fillRequiredUploadFields()

    const submit = screen.getByRole('button', { name: 'Завантажити' }) as HTMLButtonElement
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toBe(
      'Видалити товари з файлу? Рядків до видалення: 2 (з 2 по 3). Скасувати видалення не можна.',
    )
    expect(uploadProductsFromFileMock).not.toHaveBeenCalled()
  })

  it('sends the delete file after confirmation and answers with the delete text', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const showSpy = vi.spyOn(notifications, 'show')
    const { onClose } = renderModal()
    await chooseOperation('Видалити')
    fillRequiredUploadFields()

    const submit = screen.getByRole('button', { name: 'Завантажити' }) as HTMLButtonElement
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)

    await waitFor(() => expect(uploadProductsFromFileMock).toHaveBeenCalledTimes(1))
    expect(uploadProductsFromFileMock.mock.calls[0][0]).toMatchObject({ Mode: 2 })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Товари з файлу видалено' }))
  })

  it('does not ask for confirmation when adding and names the add operation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const showSpy = vi.spyOn(notifications, 'show')
    uploadProductsFromFileMock.mockResolvedValue({ processed: 3, skipped: [] })
    const { onClose } = renderModal()
    fillRequiredUploadFields()
    fireEvent.click(screen.getByRole('radio', { name: 'Товар' }))

    const submit = screen.getByRole('button', { name: 'Завантажити' }) as HTMLButtonElement
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Товари з файлу додано: 3' }))
  })

  it('keeps the dialog open and lists every row the server left out', async () => {
    const showSpy = vi.spyOn(notifications, 'show')
    uploadProductsFromFileMock.mockResolvedValue({
      processed: 1,
      skipped: [
        { reason: 'DuplicateInFile', row: 3, vendorCode: 'F3-PRD-004' },
        { reason: 'AlreadyExists', row: 4, vendorCode: 'F3-PRD-001' },
      ],
    })
    const { onClose, onUploadSuccess } = renderModal()
    fillRequiredUploadFields()
    fireEvent.click(screen.getByRole('radio', { name: 'Товар' }))

    const submit = screen.getByRole('button', { name: 'Завантажити' }) as HTMLButtonElement
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)

    const report = await screen.findByTestId('product-upload-skipped-report')
    expect(report.textContent).toContain('Товари з файлу додано: 1. Пропущено рядків: 2')
    expect(report.textContent).toContain('Рядок 3 · F3-PRD-004 — код повторюється у файлі')
    expect(report.textContent).toContain('Рядок 4 · F3-PRD-001 — товар з таким кодом уже існує')
    expect(onUploadSuccess).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(showSpy).not.toHaveBeenCalled()
  })

  it('says that nothing was applied when every row was left out', async () => {
    uploadProductsFromFileMock.mockResolvedValue({
      processed: 0,
      skipped: [{ reason: 'AlreadyExists', row: 2, vendorCode: 'F3-PRD-002' }],
    })
    renderModal()
    fillRequiredUploadFields()
    fireEvent.click(screen.getByRole('radio', { name: 'Товар' }))

    const submit = screen.getByRole('button', { name: 'Завантажити' }) as HTMLButtonElement
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)

    const report = await screen.findByTestId('product-upload-skipped-report')
    expect(report.textContent).toContain('Жоден рядок файлу не застосовано. Пропущено рядків: 1')
    expect(report.textContent).not.toContain('додано')
  })

  it('reads the server answer and tolerates an API that sends no body', () => {
    expect(normalizeProductFileUploadResult(null)).toBeNull()
    expect(normalizeProductFileUploadResult(undefined)).toBeNull()
    expect(normalizeProductFileUploadResult({
      Mode: 0,
      Processed: 1,
      Skipped: [{ Reason: 'DuplicateInFile', Row: 3, VendorCode: 'F3-PRD-004' }],
    })).toEqual({ processed: 1, skipped: [{ reason: 'DuplicateInFile', row: 3, vendorCode: 'F3-PRD-004' }] })
    expect(countProductFileUploadRows({ endRow: 3, startRow: 2 })).toBe(2)
    expect(countProductFileUploadRows({ endRow: 1, startRow: 2 })).toBe(0)
  })
})

async function chooseOperation(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Операція' }))
  fireEvent.click(await screen.findByRole('option', { name: label, hidden: true }))
}

function fillRequiredUploadFields() {
  fireEvent.change(screen.getByRole('textbox', { name: /^З(\s|\*|$)/ }), { target: { value: '2' } })
  fireEvent.change(screen.getByRole('textbox', { name: /^По(\s|\*|$)/ }), { target: { value: '3' } })
  fireEvent.change(screen.getByRole('textbox', { name: /^Код виробника(\s|\*|$)/ }), { target: { value: '1' } })
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [new File(['vendor'], 'products.xlsx')] } })
}

function renderModal() {
  const onClose = vi.fn()
  const onUploadSuccess = vi.fn()

  render(
    <MantineProvider>
      <I18nProvider>
        <ProductFileUploadModal
          opened
          onClose={onClose}
          onUploadSuccess={onUploadSuccess}
        />
      </I18nProvider>
    </MantineProvider>,
  )

  return { onClose, onUploadSuccess }
}
