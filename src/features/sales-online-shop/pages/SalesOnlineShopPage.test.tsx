import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { SalesOnlineShopSale } from '../types'
import { SaleDetail, SalesOnlineShopGridRow, SalesOnlineShopPage } from './SalesOnlineShopPage'

const { usePermissionsMock } = vi.hoisted(() => ({
  usePermissionsMock: vi.fn(() => ({ can: () => false, isLoading: false })),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: usePermissionsMock,
}))

vi.mock('../../sales-ukraine/components/SaleDocumentsMenu', () => ({
  SaleDocumentsMenu: () => <button type="button">Документи</button>,
}))

describe('SaleDetail', () => {
  it('places the transporter icon and name in the value column', () => {
    const sale = {
      ClientAgreement: { Agreement: { Name: 'Договір' }, Client: { FullName: 'Клієнт' } },
      NetUid: 'dc8d6ccc-e2f3-4011-a73f-9be8a570b2ae',
      Order: { OrderItems: [] },
      SaleNumber: { Value: 'КАв00002566' },
      Transporter: { Name: 'Нова пошта' },
    } as unknown as SalesOnlineShopSale

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <SaleDetail sale={sale} />
        </I18nProvider>
      </MantineProvider>,
    )

    const label = screen.getByText('Перевізник')
    const row = label.closest('.sale-detail-row')
    const value = row?.querySelector('.sale-detail-row-value')
    const icon = screen.getByRole('img', { name: 'Нова пошта' })

    expect(value).toBeTruthy()
    expect(label.classList.contains('sale-detail-row-label')).toBe(true)
    expect(value?.textContent).toBe('Нова пошта')
    expect(value?.contains(icon)).toBe(true)
    expect(label.parentElement).toBe(row)
  })
})

describe('SalesOnlineShopGridRow shipment acceptance', () => {
  it('labels the action according to IsAcceptedToPacking=true semantics', () => {
    const sale = {
      BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
      ChangedToInvoice: '2026-08-04T05:06:33Z',
      ClientAgreement: { Agreement: { Name: 'Договір' }, Client: { FullName: 'Клієнт' } },
      IsAcceptedToPacking: false,
      IsVatSale: true,
      NetUid: 'dc8d6ccc-e2f3-4011-a73f-9be8a570b2ae',
      Order: { OrderItems: [] },
      SaleNumber: { Value: 'КАв00002566' },
    } as unknown as SalesOnlineShopSale
    const noop = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <SalesOnlineShopGridRow
            canEditSale={false}
            canExpand={false}
            canOpenDeliveryDetails={false}
            canOpenSale={false}
            canPrintConsignmentNote={false}
            canUnlock={false}
            canViewAudit={false}
            canWillNotShip
            isAdmin={false}
            isExpanded={false}
            sale={sale}
            saleKey="sale-1"
            onOpenAudit={noop}
            onOpenConsignment={noop}
            onOpenDetails={noop}
            onOpenDiscount={noop}
            onOpenEditor={noop}
            onOpenSale={noop}
            onToggleExpand={noop}
            onUnlock={noop}
            onWillNotShip={noop}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByRole('button', {
      name: 'Розблокувати для відвантаження',
    })).toBeTruthy()
    expect(screen.queryByText(/не буде відвантажено/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Документи' })).toBeTruthy()
  })

  it('keeps the payment document available before a VAT sale becomes a consignment note', () => {
    const sale: SalesOnlineShopSale = {
      BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
      ClientAgreement: { Agreement: { Name: 'Договір' }, Client: { FullName: 'Клієнт' } },
      IsAcceptedToPacking: false,
      IsVatSale: true,
      NetUid: 'dc8d6ccc-e2f3-4011-a73f-9be8a570b2ae',
      Order: { OrderItems: [] },
      SaleNumber: { Value: 'КАв00002566' },
    }
    const noop = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <SalesOnlineShopGridRow
            canEditSale={false}
            canExpand={false}
            canOpenDeliveryDetails={false}
            canOpenSale={false}
            canPrintConsignmentNote={false}
            canUnlock={false}
            canViewAudit={false}
            canWillNotShip={false}
            isAdmin={false}
            isExpanded={false}
            sale={sale}
            saleKey="sale-1"
            onOpenAudit={noop}
            onOpenConsignment={noop}
            onOpenDetails={noop}
            onOpenDiscount={noop}
            onOpenEditor={noop}
            onOpenSale={noop}
            onToggleExpand={noop}
            onUnlock={noop}
            onWillNotShip={noop}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: 'Документи' })).toBeTruthy()
  })

  it.each([
    ['Packaged', 2],
    ['Shipping', 3],
    ['Received', 4],
    ['Await', 5],
  ])('does not expose packing acceptance after the server window: %s', (name, lifecycle) => {
    const sale = {
      BaseLifeCycleStatus: { Name: name, SaleLifeCycleType: lifecycle },
      ChangedToInvoice: '2026-08-04T05:06:33Z',
      ClientAgreement: { Agreement: { Name: 'Договір' }, Client: { FullName: 'Клієнт' } },
      IsAcceptedToPacking: false,
      IsVatSale: true,
      NetUid: 'dc8d6ccc-e2f3-4011-a73f-9be8a570b2ae',
      Order: { OrderItems: [] },
      SaleNumber: { Value: 'КАв00002566' },
    } as unknown as SalesOnlineShopSale
    const noop = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <SalesOnlineShopGridRow
            canEditSale={false}
            canExpand={false}
            canOpenDeliveryDetails={false}
            canOpenSale={false}
            canPrintConsignmentNote={false}
            canUnlock={false}
            canViewAudit={false}
            canWillNotShip
            isAdmin={false}
            isExpanded={false}
            sale={sale}
            saleKey="sale-1"
            onOpenAudit={noop}
            onOpenConsignment={noop}
            onOpenDetails={noop}
            onOpenDiscount={noop}
            onOpenEditor={noop}
            onOpenSale={noop}
            onToggleExpand={noop}
            onUnlock={noop}
            onWillNotShip={noop}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.queryByRole('button', {
      name: 'Розблокувати для відвантаження',
    })).toBeNull()
  })

  it('keeps row details and business actions independently permission-scoped', async () => {
    const sale = {
      BaseLifeCycleStatus: { Name: 'Packaging', SaleLifeCycleType: 1 },
      ClientAgreement: { Agreement: { Name: 'Договір' }, Client: { FullName: 'Клієнт' } },
      IsAcceptedToPacking: true,
      NetUid: 'dc8d6ccc-e2f3-4011-a73f-9be8a570b2ae',
      Order: { OrderItems: [{ NetUid: 'item-1' }] },
      SaleNumber: { Value: 'КАв00002566' },
      Transporter: { Name: 'Нова пошта' },
      TransporterId: 1,
    } as unknown as SalesOnlineShopSale
    const handlers = {
      onOpenAudit: vi.fn(),
      onOpenConsignment: vi.fn(),
      onOpenDetails: vi.fn(),
      onOpenDiscount: vi.fn(),
      onOpenEditor: vi.fn(),
      onOpenSale: vi.fn(),
      onToggleExpand: vi.fn(),
      onUnlock: vi.fn(),
      onWillNotShip: vi.fn(),
    }

    const { rerender } = render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <SalesOnlineShopGridRow
            {...handlers}
            canEditSale={false}
            canExpand={false}
            canOpenDeliveryDetails={false}
            canOpenSale={false}
            canPrintConsignmentNote={false}
            canUnlock={false}
            canViewAudit={false}
            canWillNotShip={false}
            isAdmin={false}
            isExpanded={false}
            sale={sale}
            saleKey="sale-1"
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.queryByRole('button', { name: 'Відкрити продаж' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Деталі' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Дії' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Нова пошта' })).toBeNull()

    rerender(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <SalesOnlineShopGridRow
            {...handlers}
            canEditSale={false}
            canExpand
            canOpenDeliveryDetails
            canOpenSale
            canPrintConsignmentNote
            canUnlock={false}
            canViewAudit
            canWillNotShip={false}
            isAdmin={false}
            isExpanded={false}
            sale={sale}
            saleKey="sale-1"
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: 'Відкрити продаж' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Деталі' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Нова пошта' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Розгорнути' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Дії' }))
    expect(await screen.findByText('Дані доставки')).toBeTruthy()
    expect(screen.getByText('Друк ТТН')).toBeTruthy()
    expect(screen.getByText('Історія редагувань')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Розблокувати' })).toBeNull()
  })
})

describe('SalesOnlineShopPage page boundary', () => {
  it('does not mount the orders or image-search workspaces without page view', () => {
    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <SalesOnlineShopPage />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(screen.queryByText('Режим інтернет-магазину')).toBeNull()
  })
})
