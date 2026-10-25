import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { ProductFullDetailPanel } from './ProductFullDetailPanel'

const priceHint = vi.hoisted(() => vi.fn(() => null))
vi.mock('./WizardAiPriceHint', () => ({ WizardAiPriceHint: priceHint }))

type Props = ComponentProps<typeof ProductFullDetailPanel>

function fixture(overrides: Partial<Props> = {}): Props {
  return {
    canEditDescription: true,
    chips: [
      { key: 'accounts', name: 'В рахунках', count: 0 },
      { key: 'vat', name: 'Склади Україна (ПДВ)', count: 2 },
      { key: 'resale', name: 'Перепродаж', count: 3 },
    ],
    descriptionDraft: 'F5127-MN',
    displayQty: 2,
    isEditingDescription: false,
    isFullDetail: true,
    isVatSale: true,
    localCurrencyCode: 'UAH',
    pricing: {
      PriceEUR: 24.48,
      DiscountPriceEUR: 22,
      DiscountRate: 10,
      RetailPriceEUR: 32.07,
      RetailPriceLocal: 1670.78,
      Pricing: { Name: 'ЦО2 (НДС)' },
    },
    product: {
      NetUid: 'product-1',
      VendorCode: 'KI00085',
      NameUA: 'Амортизатор',
      MainOriginalNumber: '2376002000*',
      Top: 'X9',
      Size: 'M',
      MeasureUnit: { Name: 'шт' },
      Description: 'F5127-MN',
      AvailableQtyUkVAT: 2,
      AvailableQtyUk: 4,
      AvailableQtyUkReSale: 3,
      CurrentPrice: 24.48,
      CurrentLocalPrice: 1275.41,
      CurrentPriceReSale: 21,
      CurrentLocalPriceReSale: 1094.1,
    },
    rows: [{ key: 'stock-3', name: 'СКЛАД -3', amount: 2, regionCode: 'UA', analyst: 'Баранов' }],
    selectedChipIndex: 1,
    selectedRowIndex: null,
    showRowDetails: false,
    onDescriptionDraftChange: vi.fn(),
    onRetryDetails: vi.fn(),
    onSelectChip: vi.fn(),
    onToggleDescription: vi.fn(),
    ...overrides,
  }
}

function tableValues(table: HTMLElement) {
  const columns = within(table).getAllByRole('columnheader').slice(1).map((header) => header.textContent?.trim() ?? '')
  return Object.fromEntries(within(table).getAllByRole('row').slice(1).map((row) => [
    within(row).getByRole('rowheader').textContent?.trim() ?? '',
    Object.fromEntries(within(row).getAllByRole('cell').map((cell, index) => [columns[index], cell.textContent?.replace(/\s+/g, ' ').trim() ?? ''])),
  ]))
}

function panel(props: Props) {
  return (
    <MantineProvider env="test" theme={theme}>
      <I18nProvider><ProductFullDetailPanel {...props} /></I18nProvider>
    </MantineProvider>
  )
}

describe('ProductFullDetailPanel', () => {
  it('opens a photo from the summary without forwarding button activation to the wizard', () => {
    const onOpenImage = vi.fn()
    const onWizardKeyDown = vi.fn()
    const view = render(<div onKeyDown={onWizardKeyDown}>{panel(fixture({ onOpenImage }))}</div>)
    const photo = screen.getByRole('button', { name: 'Збільшити фото · Амортизатор' })
    expect(photo.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.keyDown(photo, { key: 'Enter' })
    fireEvent.keyDown(photo, { key: ' ' })
    expect(onWizardKeyDown).not.toHaveBeenCalled()
    expect(onOpenImage).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(photo, { key: 'Enter', repeat: true })
    expect(onOpenImage).toHaveBeenCalledTimes(2)
    fireEvent.click(photo)
    expect(onOpenImage).toHaveBeenCalledTimes(3)

    view.rerender(panel(fixture({ onOpenImage, product: {} })))
    expect(screen.queryByRole('button', { name: /Збільшити фото/ })).toBeNull()
    expect(screen.getByLabelText('Фото відсутнє')).toBeTruthy()
  })

  it('groups product data into order-style sections while retaining prices and the photo', () => {
    render(panel(fixture()))

    expect(screen.getByRole('region', { name: 'Детальна інформація про товар' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Амортизатор' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Амортизатор' }).getAttribute('src')).toContain('ki00085_water.jpg')
    expect(screen.getByText('2376002000*')).toBeTruthy()
    expect(screen.getByText('X9')).toBeTruthy()

    const summary = within(screen.getByRole('region', { name: 'Коротка інформація про товар' }))
    expect(tableValues(summary.getByRole('table', { name: 'Ціни товару' }))).toEqual({
      'Ціна': { EUR: '24,48', UAH: '1 275,41' },
      'ЦО2 (НДС)': { EUR: '24,48', UAH: '' },
      'Зі знижкою': { EUR: '22,00', UAH: '' },
      'Роздріб': { EUR: '32,07', UAH: '1 670,78' },
    })
    const stockPrices = within(screen.getByRole('region', { name: 'Наявність і ціни' }))
    expect(tableValues(stockPrices.getByRole('table', { name: 'Наявність і ціни' }))).toEqual({
      'ПДВ склад': { 'К-сть': '2 шт', EUR: '24,48', UAH: '1 275,41' },
    })
    expect(stockPrices.getByText('Знижка')).toBeTruthy()
    expect(stockPrices.getByText('10,00%')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Опис' })).getByText('F5127-MN')).toBeTruthy()
  })

  it('retains current, base, discounted and retail prices in the summary', () => {
    const props = fixture()
    render(panel({ ...props, pricing: { ...props.pricing, PriceEUR: 25.5 } }))
    const summary = within(screen.getByRole('region', { name: 'Коротка інформація про товар' }))
    const stock = summary.getByText('Доступно').parentElement as HTMLElement
    expect(stock.textContent?.replace(/\s+/g, ' ')).toBe('Доступно2шт')
    expect(tableValues(summary.getByRole('table', { name: 'Ціни товару' }))).toEqual({
      'Ціна': { EUR: '24,48', UAH: '1 275,41' },
      'ЦО2 (НДС)': { EUR: '25,50', UAH: '' },
      'Зі знижкою': { EUR: '22,00', UAH: '' },
      'Роздріб': { EUR: '32,07', UAH: '1 670,78' },
    })
    expect(summary.queryByRole('button', { name: 'Деталі' })).toBeNull()
  })

  it('shows the agreement current price passed by the wizard in the summary', () => {
    render(panel(fixture({ currentPriceEur: 30.5 })))
    const summary = within(screen.getByRole('region', { name: 'Коротка інформація про товар' }))
    expect(tableValues(summary.getByRole('table', { name: 'Ціни товару' }))['Ціна']).toEqual({ EUR: '30,50', UAH: '1 275,41' })
  })

  it('omits the duplicate summary when it is rendered in the pinned slot', () => {
    render(panel(fixture({ showSummary: false })))
    expect(screen.queryByRole('region', { name: 'Коротка інформація про товар' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Амортизатор' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Наявність і ціни' })).getByRole('table', { name: 'Наявність і ціни' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Наявність' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Опис' })).toBeTruthy()
  })

  it('places availability after the description with the same heading pattern as product details', () => {
    render(panel(fixture()))
    const details = screen.getByRole('region', { name: 'Наявність і ціни' })
    const description = screen.getByRole('region', { name: 'Опис' })
    const availability = screen.getByRole('region', { name: 'Наявність' })
    const titleOf = (section: HTMLElement) => document.getElementById(section.getAttribute('aria-labelledby') ?? '')

    expect(description.compareDocumentPosition(availability) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    for (const section of [details, description, availability]) {
      expect(section.classList.contains('document-detail-section')).toBe(true)
    }
    expect(titleOf(availability)?.textContent).toBe('Наявність')
    expect(titleOf(availability)?.className).toBe(titleOf(details)?.className)
    expect(titleOf(availability)?.parentElement?.className).toBe(titleOf(details)?.parentElement?.className)
    expect(details.contains(availability) || description.contains(availability)).toBe(false)
    expect(within(availability).getByRole('radiogroup', { name: 'Тип наявності' })).toBeTruthy()
    expect(within(availability).getByRole('region', { name: 'Деталі залишків' })).toBeTruthy()
  })

  it('renders all seven availability options in a horizontal toggle', () => {
    render(panel(fixture({ chips: [
      { key: 'accounts', name: 'В рахунках', count: 0 },
      { key: 'vat', name: 'Склади Україна (ПДВ)', count: 2 },
      { key: 'ukraine', name: 'Склади Україна', count: 0 },
      { key: 'resale', name: 'Перепродаж', count: 0 },
      { key: 'poland', name: 'Склади Польща', count: 0 },
      { key: 'to-poland', name: 'До Польщі', count: 0 },
      { key: 'to-ukraine', name: 'До України', count: 0 },
    ] })))
    const toggle = screen.getByRole('radiogroup', { name: 'Тип наявності' })
    expect(toggle.getAttribute('data-orientation')).toBe('horizontal')
    expect(within(toggle).getAllByRole('radio')).toHaveLength(7)
    expect(within(toggle).getByRole('radio', { name: 'До України 0' })).toBeTruthy()
  })

  it('renders availability as a single-choice toggle with counts and keyboard activation', () => {
    const props = fixture()
    const view = render(panel(props))
    const toggle = within(screen.getByRole('radiogroup', { name: 'Тип наявності' }))
    expect(toggle.getAllByRole('radio')).toHaveLength(3)
    expect(toggle.getByRole('radio', { name: 'Склади Україна (ПДВ) 2' })).toHaveProperty('checked', true)
    fireEvent.click(toggle.getByRole('radio', { name: 'Перепродаж 3' }))
    expect(props.onSelectChip).toHaveBeenLastCalledWith(2)
    view.rerender(panel({ ...props, selectedChipIndex: 2 }))
    expect(toggle.getByRole('radio', { name: 'Склади Україна (ПДВ) 2' })).toHaveProperty('checked', false)
    expect(toggle.getByRole('radio', { name: 'Перепродаж 3' })).toHaveProperty('checked', true)
    expect(toggle.getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1)
    fireEvent.keyDown(toggle.getByRole('radio', { name: 'В рахунках 0' }), { key: 'Enter' })
    expect(props.onSelectChip).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(toggle.getByRole('radio', { name: 'Склади Україна (ПДВ) 2' }), { key: ' ' })
    expect(props.onSelectChip).toHaveBeenLastCalledWith(1)
    expect(props.onSelectChip).toHaveBeenCalledTimes(3)
  })

  it('moves availability focus and selection with arrows, Home and End without forwarding keys', () => {
    const props = fixture()
    const onWizardKeyDown = vi.fn()
    render(<div onKeyDown={onWizardKeyDown}>{panel(props)}</div>)
    const options = screen.getAllByRole('radio')
    fireEvent.keyDown(options[0], { key: 'ArrowDown' })
    expect(props.onSelectChip).toHaveBeenLastCalledWith(1)
    expect(document.activeElement).toBe(options[1])
    fireEvent.keyDown(options[0], { key: 'ArrowUp' })
    expect(props.onSelectChip).toHaveBeenLastCalledWith(2)
    expect(document.activeElement).toBe(options[2])
    fireEvent.keyDown(options[0], { key: 'ArrowRight' })
    expect(props.onSelectChip).toHaveBeenLastCalledWith(1)
    expect(document.activeElement).toBe(options[1])
    fireEvent.keyDown(options[0], { key: 'ArrowLeft' })
    expect(props.onSelectChip).toHaveBeenLastCalledWith(2)
    expect(document.activeElement).toBe(options[2])
    fireEvent.keyDown(options[2], { key: 'Home' })
    expect(props.onSelectChip).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(options[0], { key: 'End' })
    expect(props.onSelectChip).toHaveBeenLastCalledWith(2)
    expect(onWizardKeyDown).not.toHaveBeenCalled()
  })

  it('preserves description editing and saving', () => {
    const props = fixture()
    const view = render(panel(props))
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    expect(props.onToggleDescription).toHaveBeenCalledTimes(1)
    view.rerender(panel({ ...props, isEditingDescription: true }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Опис' }), { target: { value: 'Новий опис' } })
    expect(props.onDescriptionDraftChange).toHaveBeenLastCalledWith('Новий опис')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(props.onToggleDescription).toHaveBeenCalledTimes(2)
  })

  it('shows stock loading and retry states without stale stock rows', () => {
    const props = fixture({ isLoadingDetails: true })
    const view = render(panel(props))
    expect(screen.getByRole('status').textContent).toContain('Завантаження деталей залишків')
    expect(screen.queryByRole('region', { name: 'Деталі залишків' })).toBeNull()
    view.rerender(panel({ ...props, isLoadingDetails: false, detailsError: 'Помилка завантаження' }))
    expect(screen.getByRole('alert').textContent).toBe('Помилка завантаження')
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(props.onRetryDetails).toHaveBeenCalledOnce()
    expect(screen.queryByRole('radiogroup', { name: 'Тип наявності' })).toBeNull()
  })

  it('omits the repeated toggle label and header counter from stock details', () => {
    const props = fixture()
    const view = render(panel(props))
    const stock = screen.getByRole('region', { name: 'Деталі залишків' })
    expect(within(stock).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Розташування', 'К-сть'])
    expect(within(stock).queryByText('Склади Україна (ПДВ)')).toBeNull()
    const [stockRow] = within(stock).getAllByRole('row').slice(1)
    expect(within(stockRow).getAllByRole('cell').map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['СКЛАД -3', '2 шт'])
    expect(screen.getByRole('radio', { name: 'Склади Україна (ПДВ) 2' })).toBeTruthy()

    view.rerender(panel({ ...props, rows: [], selectedChipIndex: 0 }))
    const emptyStock = screen.getByRole('region', { name: 'Деталі залишків' })
    expect(emptyStock.textContent).toBe('Немає деталізації')
    expect(within(emptyStock).queryByText('В рахунках')).toBeNull()
    expect(within(emptyStock).queryByText('0')).toBeNull()
  })

  it('retains detailed stock metadata and the nearest supply', () => {
    render(panel(fixture({
      showRowDetails: true,
      selectedRowIndex: 0,
      nearestSupplyOrder: { OrderArrivedDate: '2026-09-01T12:00:00Z', Qty: 5 },
    })))
    const [stockRow] = within(screen.getByRole('table', { name: 'Деталі залишків' })).getAllByRole('row').slice(1)
    expect(stockRow.classList.contains('is-selected')).toBe(true)
    const [location, quantity] = within(stockRow).getAllByRole('cell')
    expect([...location.querySelectorAll('.app-table-chip-label, p')].map((item) => item.textContent)).toEqual(['СКЛАД -3', 'UA', 'Баранов'])
    expect(quantity.textContent?.replace(/\s+/g, ' ').trim()).toBe('2 шт')
    const nearest = within(screen.getByRole('region', { name: 'Наявність і ціни' })).getByText('Найближча партія').parentElement as HTMLElement
    expect([...nearest.children].map((item) => item.textContent)).toEqual(['Найближча партія', '2026-09-01', '5', 'шт'])
  })

  it('retains resale prices outside VAT sales and handles empty detail data', () => {
    const props = fixture({ isVatSale: false })
    const view = render(panel(props))
    expect(tableValues(within(screen.getByRole('region', { name: 'Наявність і ціни' })).getByRole('table', { name: 'Наявність і ціни' }))).toEqual({
      'Склад': { 'К-сть': '4 шт', EUR: '24,48', UAH: '1 275,41' },
      'Перепродаж': { 'К-сть': '3 шт', EUR: '21,00', UAH: '1 094,10' },
    })
    view.rerender(panel({ ...props, product: {}, pricing: null, rows: [], canEditDescription: false }))
    expect(screen.getByText('Код відсутній')).toBeTruthy()
    expect(screen.getByText('Опис відсутній')).toBeTruthy()
    expect(screen.getByText('Немає деталізації')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
  })
})


describe('full product card render isolation', () => {
  it('does not rebuild prices, stock rows or price hints while typing a description', () => {
    const priceRead = vi.fn(() => 25)
    const stockRead = vi.fn(() => 'Tracked stock')
    const props = fixture({
      isEditingDescription: true,
      pricing: { get PriceEUR() { return priceRead() } },
      rows: [{ key: 'tracked', amount: 1, get name() { return stockRead() } }],
    })
    render(panel(props))
    const priceReads = priceRead.mock.calls.length
    const stockReads = stockRead.mock.calls.length
    const hintRenders = priceHint.mock.calls.length
    expect(priceReads).toBeGreaterThan(0)
    expect(stockReads).toBeGreaterThan(0)
    for (const value of ['N', 'Ne', 'New']) {
      fireEvent.change(screen.getByRole('textbox', { name: 'Опис' }), { target: { value } })
    }
    expect(props.onDescriptionDraftChange).toHaveBeenLastCalledWith('New')
    expect(priceRead).toHaveBeenCalledTimes(priceReads)
    expect(stockRead).toHaveBeenCalledTimes(stockReads)
    expect(priceHint).toHaveBeenCalledTimes(hintRenders)
  })

  it('does not carry an unsaved draft into a different product', () => {
    const props = fixture({ isEditingDescription: true })
    const view = render(panel(props))
    fireEvent.change(screen.getByRole('textbox', { name: 'Опис' }), { target: { value: 'Old draft' } })
    view.rerender(panel({ ...props, product: { ...props.product, NetUid: 'product-2' }, descriptionDraft: 'Second description' }))
    expect(screen.getByRole('textbox', { name: 'Опис' })).toHaveProperty('value', 'Second description')
  })
})

it('keeps the product summary unchanged while navigating stock rows, but refreshes price and image actions', () => {
  const props = fixture({ onOpenImage: vi.fn() })
  const readNumber = vi.fn(() => '2376002000*')
  Object.defineProperty(props.product, 'MainOriginalNumber', { get: readNumber, configurable: true })
  const ui = (value: Props) => <MantineProvider env="test"><I18nProvider><ProductFullDetailPanel {...value} /></I18nProvider></MantineProvider>
  const view = render(ui(props))
  readNumber.mockClear()
  for (let index = 0; index < 20; index++) view.rerender(ui({ ...props, selectedRowIndex: index }))
  expect(readNumber).not.toHaveBeenCalled()
  view.rerender(ui({ ...props, currentPriceEur: 123.45 }))
  expect(readNumber).toHaveBeenCalled()
  expect(screen.getAllByText('123,45').length).toBeGreaterThan(0)
  const onOpenImage = vi.fn()
  view.rerender(ui({ ...props, onOpenImage }))
  fireEvent.click(screen.getByRole('button', { name: 'Збільшити фото · Амортизатор' }))
  expect(onOpenImage).toHaveBeenCalledOnce()
  expect(props.onOpenImage).not.toHaveBeenCalled()
})
