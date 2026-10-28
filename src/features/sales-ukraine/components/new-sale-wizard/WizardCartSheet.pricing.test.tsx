import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import type { SalesUkraineOrderItem } from '../../types'
import { getProductCalculatedPricingsByAgreement, type WizardCalculatedProductPricing } from './newSaleWizardApi'
import { WizardCartSheet } from './WizardCartSheet'
import type { WizardSaleProduct } from './wizardSaleProduct'

vi.mock('./newSaleWizardApi', () => ({ getProductCalculatedPricingsByAgreement: vi.fn() }))
vi.mock('./WizardProductPhoto', () => ({ WizardProductPhoto: () => null }))
vi.mock('../../../../shared/ui/AppBottomSheet', () => ({ AppBottomSheet: ({ opened, headerTools, children }: {
  opened: boolean; headerTools: ReactNode; children: ReactNode
}) => opened ? <div>{headerTools}{children}</div> : null }))

const agreement = '6325a44e-fbf4-4f29-8966-bd661ee79f8f'
const firstProduct = 'babb5a2f-80e3-43b3-b8c4-15679a5250ea'
const secondProduct = '7a0cf087-1b98-45ab-b2ec-4fd6f29fc7d3'
const items: SalesUkraineOrderItem[] = [
  { NetUid: 'acdf4f81-7f50-4b3a-886b-cbdfe4a7e587', Qty: 4, TotalAmount: 80, TotalAmountEurToUah: 4152,
    Product: { NetUid: firstProduct, VendorCode: '926012630077-SL', CurrentPrice: 20, CurrentPriceEurToUah: 1038 } as WizardSaleProduct },
  { NetUid: '44487d42-52ca-4fa2-ab1d-5d21b849ad3b', Qty: 3, TotalAmount: 62.13, TotalAmountEurToUah: 3224.547,
    Product: { NetUid: secondProduct, VendorCode: '93221PCNT', CurrentPrice: 20.71, CurrentPriceEurToUah: 1074.849 } as WizardSaleProduct },
  { NetUid: '6915e55e-3a8b-43ce-9ba9-b1ba70845631', Qty: 1, TotalAmount: 20.71, TotalAmountEurToUah: 1074.849,
    Product: { NetUid: secondProduct, VendorCode: '93221PCNT', CurrentPrice: 20.71, CurrentPriceEurToUah: 1074.849 } as WizardSaleProduct },
]
const pricing = (product: string): WizardCalculatedProductPricing[] => [{ Pricing: { Name: 'ЦО2' },
  PriceEUR: product === firstProduct ? 20 : 20.71, DiscountPriceEUR: product === firstProduct ? 20 : 20.71,
  RetailPriceEUR: product === firstProduct ? 26.2 : 27.13, RetailPriceLocal: product === firstProduct ? 1359.78 : 1408.05 }]
const actions = { onClose: vi.fn(), onOpen: vi.fn(), onEditCart: vi.fn(), onRowClick: vi.fn(), onRemove: vi.fn() }
function ui(agreementNetId: string | null = agreement, opened = true, rows = items) {
  return <MantineProvider env="test"><I18nProvider><WizardCartSheet {...actions} agreementNetId={agreementNetId}
    busy={false} opened={opened} items={rows} localCurrencyCode="UAH" useEurToUah /></I18nProvider></MantineProvider>
}
function rowText(card: HTMLElement, name: string) {
  return within(card).getByRole('rowheader', { name }).parentElement!.textContent!.replace(/\s/g, '')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getProductCalculatedPricingsByAgreement).mockImplementation(async product => pricing(product))
})

it('shows all reference prices directly in each cart card and preserves duplicate line totals and actions', async () => {
  render(ui())
  await screen.findAllByRole('rowheader', { name: 'ЦО2' })
  const cards = screen.getAllByRole('listitem')
  expect(rowText(cards[0], 'ЦО2')).toBe('ЦО220,00—')
  expect(rowText(cards[0], 'Зі знижкою')).toBe('Зізнижкою20,00—')
  expect(rowText(cards[0], 'Роздріб')).toBe('Роздріб26,201359,78')
  expect(rowText(cards[0], 'Ціна')).toBe('Ціна20,001038,00')
  expect(rowText(cards[0], 'Сума')).toBe('Сума80,004152,00')
  expect(rowText(cards[1], 'Роздріб')).toBe('Роздріб27,131408,05')
  expect(rowText(cards[2], 'Роздріб')).toBe('Роздріб27,131408,05')
  expect(rowText(cards[1], 'Сума')).toBe('Сума62,133224,55')
  expect(rowText(cards[2], 'Сума')).toBe('Сума20,711074,85')
  expect(getProductCalculatedPricingsByAgreement).toHaveBeenCalledTimes(2)
  expect(getProductCalculatedPricingsByAgreement).toHaveBeenCalledWith(firstProduct, agreement, expect.any(AbortSignal))
  const first = within(cards[0]).getByRole('button', { name: 'Дії з товаром · 926012630077-SL' })
  first.focus()
  fireEvent.keyDown(first, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(within(cards[1]).getByRole('button', { name: 'Дії з товаром · 93221PCNT' }))
  fireEvent.click(first)
  expect(actions.onRowClick).toHaveBeenCalledWith(items[0])
  fireEvent.click(within(cards[2]).getByRole('button', { name: 'Видалити' }))
  expect(actions.onRemove).toHaveBeenCalledWith(items[2])
})

it('does not request prices while closed and rejects late prices after the agreement changes', async () => {
  let resolveOld!: (value: WizardCalculatedProductPricing[]) => void
  vi.mocked(getProductCalculatedPricingsByAgreement).mockImplementation(() => new Promise(resolve => { resolveOld = resolve }))
  const view = render(ui(agreement, false, items.slice(0, 1)))
  expect(getProductCalculatedPricingsByAgreement).not.toHaveBeenCalled()
  view.rerender(ui(agreement, true, items.slice(0, 1)))
  await waitFor(() => expect(getProductCalculatedPricingsByAgreement).toHaveBeenCalledOnce())
  const signal = vi.mocked(getProductCalculatedPricingsByAgreement).mock.calls[0][2]!
  vi.mocked(getProductCalculatedPricingsByAgreement).mockResolvedValue([{ Pricing: { Name: 'ЦО1 (НДС)' }, PriceEUR: 30, DiscountPriceEUR: 28, RetailPriceEUR: 35, RetailPriceLocal: 1816.5 }])
  view.rerender(ui('90069b09-f83b-4b8b-9faa-d4e313785afc', true, items.slice(0, 1)))
  expect(signal.aborted).toBe(true)
  expect(screen.queryByRole('rowheader', { name: 'ЦО2' })).toBeNull()
  await screen.findByRole('rowheader', { name: 'ЦО1 (НДС)' })
  await act(async () => resolveOld(pricing(firstProduct)))
  expect(screen.queryByRole('rowheader', { name: 'ЦО2' })).toBeNull()
  expect(rowText(screen.getByRole('listitem'), 'ЦО1 (НДС)')).toBe('ЦО1(НДС)30,00—')
  expect(rowText(screen.getByRole('listitem'), 'Ціна')).toBe('Ціна20,001038,00')
})

it('reports failed or missing pricing without inventing prices and supports retry and legitimate zero', async () => {
  vi.mocked(getProductCalculatedPricingsByAgreement).mockRejectedValue(new Error('Unavailable'))
  render(ui(agreement, true, items.slice(0, 1)))
  await screen.findByText('Не вдалося завантажити типи цін')
  expect(screen.queryByRole('rowheader', { name: 'Зі знижкою' })).toBeNull()
  vi.mocked(getProductCalculatedPricingsByAgreement).mockResolvedValue([{ Pricing: { Name: 'ЦО2' }, PriceEUR: 0, DiscountPriceEUR: 0 }])
  fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
  await screen.findByRole('rowheader', { name: 'ЦО2' })
  const card = screen.getByRole('listitem')
  expect(rowText(card, 'ЦО2')).toBe('ЦО20,00—')
  expect(rowText(card, 'Зі знижкою')).toBe('Зізнижкою0,00—')
  expect(rowText(card, 'Роздріб')).toBe('Роздріб——')
})

it('reports empty pricing explicitly while retaining document values', async () => {
  vi.mocked(getProductCalculatedPricingsByAgreement).mockResolvedValue([])
  render(ui(agreement, true, items.slice(0, 1)))
  await screen.findByText('Типи цін недоступні')
  expect(rowText(screen.getByRole('listitem'), 'Ціна')).toBe('Ціна20,001038,00')
  expect(screen.queryByRole('rowheader', { name: 'Зі знижкою' })).toBeNull()
})
