import { readFileSync } from 'node:fs'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../src/shared/i18n/I18nProvider'
import { theme } from '../src/shared/theme/theme'
import type { SalesUkraineSale } from '../src/features/sales-ukraine/types'
import { SalesUkrainePage } from '../src/features/sales-ukraine/pages/SalesUkrainePage'

const product = {
  NetUid: 'd490a0e4-cf0f-4270-ac52-4c6123dfcca4',
  VendorCode: '011.058-00-PE',
  NameUA: 'Кільце ущільнююче',
  MainOriginalNumber: '007603045100*',
}

const sale: SalesUkraineSale = {
  Id: 2132458,
  NetUid: '60750b28-8f4a-47a9-94e6-6caf16949a93',
  SaleNumber: { Value: 'Ок00000003' },
  Created: '2026-10-20T13:54:21.92',
  TotalAmountLocal: 13.5,
  TotalAmountEurToUah: 689.85,
  TotalRowsQty: 1,
  TotalPositions: 2,
  BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
  ClientAgreement: {
    Client: {
      RegionCode: { Value: 'BOD04903' },
      FullName: 'ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ МАРКУС ДЕНИС ВІТАЛІЙОВИЧ',
    },
    Agreement: { Name: 'Default', Currency: { Code: 'EUR' } },
  },
  Order: {
    OrderItems: [
      { Id: 1, NetUid: '34047a0a-c8e3-4242-9ce0-a2135d56dc99', Product: product, Qty: 16, TotalAmountLocal: 3.36, TotalAmountEurToUah: 171.696 },
      { Id: 2, NetUid: 'c0065f98-3185-4ff4-8c88-6d2cb010e1f7', Product: product, Qty: 39, TotalAmountLocal: 10.14, TotalAmountEurToUah: 518.154 },
    ],
  },
}

const mocks = vi.hoisted(() => ({
  getSalesUkraine: vi.fn(),
  getSalesUkraineSaleDetails: vi.fn(),
  getProductByNetId: vi.fn(),
}))

vi.mock('../src/features/sales-ukraine/api/salesUkraineApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/sales-ukraine/api/salesUkraineApi')>(),
  getSalesUkraine: mocks.getSalesUkraine,
  getSalesUkraineSaleDetails: mocks.getSalesUkraineSaleDetails,
  getSalesUkraineOrganizations: vi.fn(async () => []),
}))

vi.mock('../src/features/products/api/productsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/products/api/productsApi')>(),
  getProductByNetId: mocks.getProductByNetId,
}))

vi.mock('../src/features/auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: { FirstName: 'Test', LastName: 'User', NetUid: 'user-1' },
  }),
}))

vi.mock('../src/shared/realtime/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/shared/realtime/events')>(),
  useRealtimeEvent: () => {},
}))

vi.mock('../src/features/products/components/ShopImageGallery', () => ({ ShopImageGallery: () => null }))

let styles: HTMLStyleElement

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.getSalesUkraine.mockResolvedValue([{ ...sale, Order: undefined, HasDetails: false }])
  mocks.getSalesUkraineSaleDetails.mockResolvedValue({ ...sale, HasDetails: true })
  mocks.getProductByNetId.mockResolvedValue(product)
  HTMLElement.prototype.scrollIntoView = vi.fn()
  styles = document.createElement('style')
  styles.textContent = [
    'src/shared/theme/table-chips.css',
    'src/features/sales-ukraine/pages/sales-grid.css',
    'src/features/products/components/product-card-modal.css',
  ].map((path) => readFileSync(path, 'utf8').replace(/@import[^;]+;/g, '')).join('\n')
  document.head.append(styles)
})

afterEach(() => styles.remove())

async function renderRegistry() {
  render(
    <MantineProvider theme={theme}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/sales/ukraine/all']}>
          <SalesUkrainePage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
  return screen.findByText('BOD04903')
}

async function expandSale() {
  await renderRegistry()
  fireEvent.click(screen.getByRole('button', { name: 'Розгорнути', exact: true }))
  return screen.findAllByRole('button', { name: product.VendorCode, exact: true })
}

describe('BUG-1394 identifiers in the sales registry and its product card', () => {
  it('enlarges the client code without enlarging document metadata', async () => {
    const code = await renderRegistry()
    expect(getComputedStyle(code).fontSize).toBe('13px')
    expect(getComputedStyle(code).lineHeight).toBe('18px')
    const number = screen.getByText('Ок00000003')
    expect(getComputedStyle(number).fontSize).toBe('11px')
  })

  it('enlarges both article badges in the expanded sale and preserves quantities', async () => {
    const articles = await expandSale()
    expect(articles).toHaveLength(2)
    for (const article of articles) {
      const chip = article.querySelector('.app-table-chip')!
      expect(getComputedStyle(chip).fontSize).toBe('13px')
      expect(getComputedStyle(chip).lineHeight).toBe('18px')
    }
    expect(screen.getByText('16')).toBeTruthy()
    expect(screen.getByText('39')).toBeTruthy()
    expect(mocks.getSalesUkraineSaleDetails).toHaveBeenCalled()
    expect(mocks.getSalesUkraineSaleDetails.mock.calls[0][0]).toBe(sale.NetUid)
  })

  it('opens the same product with a larger article and the selected line price', async () => {
    const articles = await expandSale()
    fireEvent.click(articles[0])
    const dialog = await screen.findByRole('dialog', { name: 'Картка товару' })
    const article = await within(dialog).findByText(product.VendorCode)
    const chip = article.closest('.app-table-chip')!
    expect(getComputedStyle(chip).fontSize).toBe('14px')
    expect(getComputedStyle(chip).lineHeight).toBe('20px')
    expect(mocks.getProductByNetId.mock.calls[0][0]).toBe(product.NetUid)
    expect(getComputedStyle(within(dialog).getByText(product.MainOriginalNumber).closest('.app-table-chip')!).fontSize).toBe('12px')
    const prices = within(dialog).getByRole('table', { name: 'Ціни товару' })
    expect(within(prices).getByText('0,21')).toBeTruthy()
    expect(within(prices).getByText('10,73')).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'Відкрити' }).getAttribute('href')).toBe(`/products?netId=${product.NetUid}`)
  })
})
