import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type {
  ProductDeliveryExpense,
  SupplyServiceConsumableProduct,
  SupplyServiceOrganization,
  SupplyServiceOrganizationAgreement,
  SupplyUkraineOrderRow,
} from '../types'
import { OfficialCostsModal } from './SupplyUkraineOrdersPage'

const apiMocks = vi.hoisted(() => ({
  createSupplyOrderUkraineDeliveryExpense: vi.fn(),
  getSupplyOrderServiceConsumableProducts: vi.fn(),
  searchSupplyOrderServiceOrganizations: vi.fn(),
  updateSupplyOrderUkraineDeliveryExpense: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../api/supplyUkraineOrdersApi', () => apiMocks)

const agreement: SupplyServiceOrganizationAgreement = {
  Id: 17,
  Name: 'Основний договір',
}

const organization: SupplyServiceOrganization = {
  Id: 11,
  Name: 'Автосервіси Думанських, ТОВ',
  SupplyOrganizationAgreements: [agreement],
}

const product: SupplyServiceConsumableProduct = {
  Id: 23,
  Name: 'Послуги доставки',
}

function createRow(
  invoiceNumber = '464545',
  consumableProduct: SupplyServiceConsumableProduct | null = null,
): SupplyUkraineOrderRow {
  const expense: ProductDeliveryExpense = {
    AccountingGrossAmount: 0,
    AccountingVatPercent: 0,
    ConsumableProduct: consumableProduct,
    ConsumableProductId: consumableProduct?.Id ?? null,
    FromDate: '2026-08-15T15:09:00',
    GrossAmount: 1000,
    Id: 29,
    InvoiceNumber: invoiceNumber,
    SupplyOrderUkraineId: 41,
    SupplyOrganization: organization,
    SupplyOrganizationAgreement: agreement,
    SupplyOrganizationAgreementId: agreement.Id,
    SupplyOrganizationId: organization.Id,
    VatPercent: 20,
  }

  return {
    index: 1,
    kind: 'toUkraine',
    order: {
      DeliveryExpenses: [expense],
      Id: 41,
    },
  }
}

function renderModal(row: SupplyUkraineOrderRow, onSaved = vi.fn()) {
  render(
    <MantineProvider>
      <I18nProvider>
        <OfficialCostsModal row={row} onClose={() => undefined} onSaved={onSaved} />
      </I18nProvider>
    </MantineProvider>,
  )

  return { onSaved }
}

describe('official delivery costs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.createSupplyOrderUkraineDeliveryExpense.mockResolvedValue(undefined)
    apiMocks.getSupplyOrderServiceConsumableProducts.mockResolvedValue([product])
    apiMocks.searchSupplyOrderServiceOrganizations.mockResolvedValue([organization])
    apiMocks.updateSupplyOrderUkraineDeliveryExpense.mockResolvedValue(undefined)
  })

  it('saves an official expense without a type', async () => {
    const { onSaved } = renderModal(createRow())

    await screen.findByDisplayValue('Автосервіси Думанських, ТОВ')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(apiMocks.updateSupplyOrderUkraineDeliveryExpense).toHaveBeenCalledTimes(1))

    const payload = apiMocks.updateSupplyOrderUkraineDeliveryExpense.mock.calls[0][0]
    expect(payload).toMatchObject({
      ConsumableProduct: null,
      ConsumableProductId: null,
      InvoiceNumber: '464545',
      SupplyOrderUkraineId: 41,
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('preserves a selected optional type', async () => {
    renderModal(createRow('464545', product))

    await screen.findByDisplayValue('Послуги доставки')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(apiMocks.updateSupplyOrderUkraineDeliveryExpense).toHaveBeenCalledTimes(1))
    expect(apiMocks.updateSupplyOrderUkraineDeliveryExpense.mock.calls[0][0]).toMatchObject({
      ConsumableProduct: product,
      ConsumableProductId: 23,
    })
  })

  it('still requires an invoice number when the type is empty', async () => {
    renderModal(createRow('   '))

    await screen.findByDisplayValue('Автосервіси Думанських, ТОВ')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Заповніть організацію, договір і номер інвойса')).toBeTruthy()
    expect(apiMocks.updateSupplyOrderUkraineDeliveryExpense).not.toHaveBeenCalled()
  })
})
