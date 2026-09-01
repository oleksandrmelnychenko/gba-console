import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineSale } from '../types'

const mocks = vi.hoisted(() => ({
  getSalesUkraineDeliveryDetails: vi.fn(),
  getSalesUkraineSaleDetails: vi.fn(),
  getSalesUkraine: vi.fn(),
  granted: new Set<string>(),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => mocks.granted.has(permission),
    user: { FirstName: 'Тест', LastName: 'Користувач', NetUid: 'user-1' },
  }),
}))

vi.mock('../api/salesUkraineApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/salesUkraineApi')>(),
  getSalesUkraineDeliveryDetails: mocks.getSalesUkraineDeliveryDetails,
  getSalesUkraineSaleDetails: mocks.getSalesUkraineSaleDetails,
  getSalesUkraine: mocks.getSalesUkraine,
  getSalesUkraineOrganizations: vi.fn(async () => []),
}))

vi.mock('../components/SaleDetailsDrawer', () => ({
  SaleDetailsDrawer: ({
    canEdit,
    loadSale,
    onSaved,
    sale,
  }: {
    canEdit?: boolean
    loadSale?: unknown
    onSaved: (sale: SalesUkraineSale) => void
    sale: SalesUkraineSale
  }) => (
    <div data-testid="delivery-drawer">
      {`edit:${String(canEdit)};protected:${String(loadSale === mocks.getSalesUkraineDeliveryDetails)}`}
      <span data-testid="delivery-own-ttn">{sale.CustomersOwnTtn?.Number || ''}</span>
      <button
        type="button"
        onClick={() => onSaved({
          ...sale,
          CustomersOwnTtn: {
            Id: 81,
            Number: 'TTN-7857',
            TtnPDFPath: '/Data/Temp/CustomersTTN-saved.pdf',
          },
        })}
      >
        Зберегти власну ТТН
      </button>
    </div>
  ),
}))

vi.mock('../../../shared/realtime/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/realtime/events')>(),
  useRealtimeEvent: () => {},
}))

vi.mock('../components/new-sale-wizard/NewSaleWizard', () => ({
  NewSaleWizard: ({ canSubmitCreate }: { canSubmitCreate?: boolean }) => (
    <div aria-label="Майстер продажу" role="dialog">
      <button disabled={!canSubmitCreate} type="button">Фінальне створення продажу</button>
    </div>
  ),
}))

import { SalesUkrainePage } from './SalesUkrainePage'

const sale: SalesUkraineSale = {
  BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
  BaseSalePaymentStatus: { Name: 'NotPaid' },
  ClientAgreement: {
    Agreement: { Currency: { Code: 'EUR' }, Name: 'Договір' },
    Client: { FullName: 'Клієнт без granular прав', RegionCode: { Value: 'КИЇ001' } },
  },
  Created: '2026-08-17T10:00:00Z',
  HasDetails: false,
  Id: 1,
  IsVatSale: false,
  NetUid: 'sale-1',
  Order: { OrderItems: [{ Id: 1, NetUid: 'item-1', Qty: 1 }] },
  SaleNumber: { Value: 'КИЛ001' },
  TotalAmount: 100,
  TotalAmountLocal: 100,
  TotalRowsQty: 1,
}

function renderPage(initialEntry = '/sales/ukraine/all') {
  return render(
    <MantineProvider theme={theme}>
      <Notifications />
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <SalesUkrainePage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('SalesUkrainePage event permissions', () => {
  beforeEach(() => {
    mocks.granted.clear()
    mocks.getSalesUkraineDeliveryDetails.mockReset().mockImplementation(async (netUid: string) => ({
      ...sale,
      HasDetails: true,
      NetUid: netUid,
    }))
    mocks.getSalesUkraineSaleDetails.mockReset().mockImplementation(async (netUid: string) => ({
      ...sale,
      HasDetails: true,
      NetUid: netUid,
    }))
    mocks.getSalesUkraine.mockReset().mockResolvedValue([sale])
  })

  it('does not load the registry without page view permission', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(mocks.getSalesUkraine).not.toHaveBeenCalled()
  })

  it('keeps independent actions unavailable when only page view is granted', async () => {
    mocks.granted.add(PermissionKeys.SalesUkraine.Sale.View)
    const { container } = renderPage()

    await screen.findByText('Клієнт без granular прав')

    expect((screen.getByRole('button', { name: 'Новий продаж' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Відкрити продаж' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Редагування' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Дії' })).toBeNull()

    const row = container.querySelector<HTMLElement>('.sales-grid-row:not(.sales-grid-skeleton-row)')
    expect(row).toBeTruthy()
    fireEvent.click(row as HTMLElement)
    expect(mocks.getSalesUkraineSaleDetails).not.toHaveBeenCalled()
  })

  it('uses the create permission for both the entry point and final submit', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.Create,
    )
    renderPage()

    const openButton = await screen.findByRole('button', { name: 'Новий продаж' }) as HTMLButtonElement
    expect(openButton.disabled).toBe(false)
    fireEvent.click(openButton)

    const dialog = await screen.findByRole('dialog', { name: 'Майстер продажу' })
    const finalSubmit = dialog.querySelector<HTMLButtonElement>('button')

    expect(finalSubmit?.disabled).toBe(false)
  })

  it('does not treat the retired modal-opener key as permission to create', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.OpenCreateDialog,
    )
    renderPage()

    const openButton = await screen.findByRole('button', { name: 'Новий продаж' }) as HTMLButtonElement
    expect(openButton.disabled).toBe(true)
    fireEvent.click(openButton)

    expect(screen.queryByRole('dialog', { name: 'Майстер продажу' })).toBeNull()
  })

  it('hydrates and opens a row only with open-details permission', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.OpenDetails,
    )
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити продаж' }))

    await waitFor(() => expect(mocks.getSalesUkraineSaleDetails).toHaveBeenCalledWith('sale-1'))
  })

  it('does not resolve a deep-linked sale without open-details permission', async () => {
    grant(PermissionKeys.SalesUkraine.Sale.View)
    renderPage('/sales/ukraine/all?saleNetId=deep-linked-sale')

    await screen.findByText('Клієнт без granular прав')
    expect(mocks.getSalesUkraineSaleDetails).not.toHaveBeenCalled()
  })

  it('resolves a deep-linked sale through the guarded details API with open-details permission', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.OpenDetails,
    )
    renderPage('/sales/ukraine/all?saleNetId=deep-linked-sale')

    await waitFor(() => expect(mocks.getSalesUkraineSaleDetails).toHaveBeenCalledWith('deep-linked-sale'))
  })

  it('does not render an empty context-menu opener', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.OpenContextMenu,
    )
    mocks.getSalesUkraine.mockResolvedValue([actionableSale()])
    renderPage()

    await screen.findByText('Клієнт без granular прав')
    expect(screen.queryByRole('button', { name: 'Дії' })).toBeNull()
  })

  it.each([
    [PermissionKeys.SalesUkraine.Sale.OpenDeliveryDetails, 'Дані доставки'],
    [PermissionKeys.SalesUkraine.Sale.Unlock, 'Розблокувати'],
    [PermissionKeys.SalesUkraine.Sale.PrintConsignmentNote, 'Друк ТТН'],
    [PermissionKeys.SalesUkraine.Sale.ViewAudit, 'Історія редагувань'],
  ] as const)('shows only the independently granted %s context action', async (permission, label) => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      permission,
    )
    mocks.getSalesUkraine.mockResolvedValue([actionableSale()])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Дії' }))

    expect(await screen.findByRole('menuitem', { name: label })).toBeTruthy()
    for (const otherLabel of ['Дані доставки', 'Розблокувати', 'Друк ТТН', 'Історія редагувань']) {
      if (otherLabel !== label) {
        expect(screen.queryByRole('menuitem', { name: otherLabel })).toBeNull()
      }
    }
  })

  it('opens delivery through its own backend boundary and keeps edit independently denied', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.OpenDeliveryDetails,
    )
    mocks.getSalesUkraine.mockResolvedValue([actionableSale()])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Дії' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Дані доставки' }))

    await waitFor(() => expect(mocks.getSalesUkraineDeliveryDetails).toHaveBeenCalledWith('sale-1'))
    expect(mocks.getSalesUkraineSaleDetails).not.toHaveBeenCalled()
    expect((await screen.findByTestId('delivery-drawer')).textContent).toContain('edit:false;protected:true')
  })

  it('keeps the carrier drawer open and projects the persisted own TTN after save', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.OpenDeliveryDetails,
      PermissionKeys.SalesUkraine.Sale.Edit,
    )
    mocks.getSalesUkraine.mockResolvedValue([actionableSale()])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Дії' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Дані доставки' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Зберегти власну ТТН' }))

    expect(await screen.findByTestId('delivery-drawer')).toBeTruthy()
    expect(screen.getByTestId('delivery-own-ttn').textContent).toBe('TTN-7857')
    await waitFor(() => expect(mocks.getSalesUkraine).toHaveBeenCalledTimes(2))
  })

  it('does not show shipping unlock for an eligible sale without its own key', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
    )
    mocks.getSalesUkraine.mockResolvedValue([actionableSale({
      BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
      ChangedToInvoice: '2026-08-17T11:00:00Z',
      IsAcceptedToPacking: false,
      IsVatSale: true,
    })])
    renderPage()

    await screen.findByText('Клієнт без granular прав')
    expect(screen.queryByRole('button', { name: 'Дії' })).toBeNull()
  })

  it('shows shipping unlock only with its own key and eligible sale state', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.UnlockForShipping,
    )
    mocks.getSalesUkraine.mockResolvedValue([actionableSale({
      BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
      ChangedToInvoice: '2026-08-17T11:00:00Z',
      IsAcceptedToPacking: false,
      IsVatSale: true,
    })])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Дії' }))

    expect(await screen.findByRole('menuitem', { name: 'Розблокувати для відвантаження' })).toBeTruthy()
  })

  it('uses export_before_packing instead of role type for VAT documents and TTN', async () => {
    grant(
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.ExportInvoice,
      PermissionKeys.SalesUkraine.Sale.PrintConsignmentNote,
    )
    mocks.getSalesUkraine.mockResolvedValue([actionableSale({
      IsAcceptedToPacking: false,
      IsVatSale: true,
    })])
    const firstView = renderPage()

    await screen.findByText('Клієнт без granular прав')
    expect(screen.queryByRole('button', { name: 'Документи' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Дії' })).toBeNull()

    firstView.unmount()
    mocks.granted.add(PermissionKeys.SalesUkraine.Sale.ExportBeforePacking)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Документи' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Дії' }))
    expect(await screen.findByRole('menuitem', { name: 'Друк ТТН' })).toBeTruthy()
  })
})

function grant(...permissions: string[]) {
  permissions.forEach((permission) => mocks.granted.add(permission))
}

function actionableSale(overrides: Partial<SalesUkraineSale> = {}): SalesUkraineSale {
  return {
    ...sale,
    BaseLifeCycleStatus: { Name: 'Packaging', SaleLifeCycleType: 1 },
    BaseSalePaymentStatus: { Name: 'Paid' },
    HasDetails: true,
    IsAcceptedToPacking: true,
    IsLocked: true,
    TransporterId: 1,
    ...overrides,
  }
}
