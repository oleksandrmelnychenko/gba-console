import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { ProductFullDetailPanel } from './ProductFullDetailPanel'

vi.mock('./WizardAiPriceHint', () => ({ WizardAiPriceHint: () => null }))

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

    const prices = within(screen.getByRole('region', { name: 'Ціни' }))
    expect(prices.getByText('24,48 EUR')).toBeTruthy()
    expect(prices.getByText('22,00 EUR')).toBeTruthy()
    expect(prices.getByText('32,07 EUR')).toBeTruthy()
    expect(prices.getByText(/1\s670,78 UAH/)).toBeTruthy()
    expect(prices.getByText('10,00%')).toBeTruthy()
    expect(prices.getByText(/2 шт · 1\s275,41 UAH · 24,48 EUR/)).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Опис' })).getByText('F5127-MN')).toBeTruthy()
  })

  it('retains current, base, discounted and retail prices in the summary', () => {
    const props = fixture()
    render(panel({ ...props, pricing: { ...props.pricing, PriceEUR: 25.5 } }))
    const summary = within(screen.getByRole('region', { name: 'Коротка інформація про товар' }))
    for (const label of ['Доступно', 'Ціна в EUR', 'Ціна в UAH', 'ЦО2 (НДС)', 'Зі знижкою']) {
      expect(summary.getByText(label)).toBeTruthy()
    }
    for (const value of ['24,48', '25,50', '22,00', '32,07']) {
      expect(summary.getByText(value)).toBeTruthy()
    }
    expect(summary.getByText(/1\s275,41/)).toBeTruthy()
    expect(summary.getByText(/1\s670,78/)).toBeTruthy()
    expect(summary.getAllByText('Роздріб')).toHaveLength(2)
    expect(summary.queryByRole('button', { name: 'Деталі' })).toBeNull()
  })

  it('omits the duplicate summary when it is rendered in the pinned slot', () => {
    render(panel(fixture({ showSummary: false })))
    expect(screen.queryByRole('region', { name: 'Коротка інформація про товар' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Амортизатор' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Ціни' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Наявність' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Опис' })).toBeTruthy()
  })

  it('places availability after the description with the same heading pattern as product details', () => {
    render(panel(fixture()))
    const description = screen.getByRole('region', { name: 'Опис' })
    const availability = screen.getByRole('region', { name: 'Наявність' })
    const detailsHeading = screen.getByRole('heading', { name: 'Деталі товару', level: 3 })
    const availabilityHeading = within(availability).getByRole('heading', { name: 'Наявність', level: 3 })

    expect(description.compareDocumentPosition(availability) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(availability.classList.contains('new-sale-product-detail__tree')).toBe(true)
    expect(availabilityHeading.parentElement?.className).toBe(detailsHeading.parentElement?.className)
    expect(availabilityHeading.closest('.new-sale-product-detail__section')).toBeNull()
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
    const heading = within(stock).getByRole('heading', { name: 'Деталі залишків' })
    expect(heading.parentElement?.textContent).toBe('Деталі залишків')
    expect(within(stock).queryByText('Склади Україна (ПДВ)')).toBeNull()
    expect(within(stock).getByText('СКЛАД -3')).toBeTruthy()
    expect(within(stock).getByText('2')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Склади Україна (ПДВ) 2' })).toBeTruthy()

    view.rerender(panel({ ...props, rows: [], selectedChipIndex: 0 }))
    expect(heading.parentElement?.textContent).toBe('Деталі залишків')
    expect(within(stock).queryByText('В рахунках')).toBeNull()
    expect(within(stock).queryByText('0')).toBeNull()
    expect(within(stock).getByText('Немає деталізації')).toBeTruthy()
  })

  it('retains detailed stock metadata and the nearest supply', () => {
    render(panel(fixture({
      showRowDetails: true,
      selectedRowIndex: 0,
      nearestSupplyOrder: { OrderArrivedDate: '2026-09-01T12:00:00Z', Qty: 5 },
    })))
    expect(screen.getByText('UA · СКЛАД -3 · Баранов')).toBeTruthy()
    expect(screen.getByText('Найближча партія')).toBeTruthy()
    expect(screen.getByText('2026-09-01 · 5 шт')).toBeTruthy()
  })

  it('retains resale prices outside VAT sales and handles empty detail data', () => {
    const props = fixture({ isVatSale: false })
    const view = render(panel(props))
    expect(within(screen.getByRole('region', { name: 'Ціни' })).getByText(/3 шт · 1\s094,10 UAH · 21,00 EUR/)).toBeTruthy()
    view.rerender(panel({ ...props, product: {}, pricing: null, rows: [], canEditDescription: false }))
    expect(screen.getByText('Код відсутній')).toBeTruthy()
    expect(screen.getByText('Опис відсутній')).toBeTruthy()
    expect(screen.getByText('Немає деталізації')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
  })
})
