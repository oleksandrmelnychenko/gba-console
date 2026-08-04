import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { SalesOnlineShopSale } from '../types'
import { SalesOnlineShopGridRow } from './SalesOnlineShopPage'

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
            canUnlock={false}
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
            canUnlock={false}
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
})
