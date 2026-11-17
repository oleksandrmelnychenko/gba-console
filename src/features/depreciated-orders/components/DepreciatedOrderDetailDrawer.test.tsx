import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DepreciatedOrder } from '../types'
import { DepreciatedOrderDetailDrawer } from './DepreciatedOrderDetailDrawer'

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => (opened ? <section>{children}</section> : null),
}))

function renderOrder(order: DepreciatedOrder) {
  render(
    <MantineProvider><I18nProvider>
      <DepreciatedOrderDetailDrawer
        canExport={false}
        detailError={null}
        downloadDocument={null}
        downloadError={null}
        downloadOpened={false}
        isDetailLoading={false}
        isDownloading={false}
        order={order}
        onClose={() => {}}
        onCloseDownload={() => {}}
        onExport={() => {}}
      />
    </I18nProvider></MantineProvider>,
  )
}

describe('DepreciatedOrderDetailDrawer', () => {
  it('shows what this act took from each cell, not the cell remainder, and a four-digit year', () => {
    renderOrder({
      DepreciatedOrderItems: [{
        Id: 1,
        Product: { Name: 'Фільтр', VendorCode: 'D2-WO-001' },
        ProductLocations: [
          { Id: 1, ProductPlacement: { CellNumber: '3', Qty: 0, RowNumber: '2', StorageNumber: '1' }, Qty: 6 },
          { Id: 2, ProductPlacement: { CellNumber: '4', Qty: 3, RowNumber: '2', StorageNumber: '1' }, Qty: 1 },
        ],
        Qty: 7,
      }],
      FromDate: '2099-12-31T10:00:00',
      NetUid: 'order-1',
      Number: 'QAU0000000051',
    })

    expect(screen.getByText('Позиція 1-2-3. К-сть 6; Позиція 1-2-4. К-сть 1')).toBeTruthy()
    expect(screen.getByText(/31\.12\.2099/)).toBeTruthy()
    expect(screen.queryByText('Ціна, EUR')).toBeNull()
  })

  it('adds price, line sum and the document total when the payload has prices', () => {
    renderOrder({
      DepreciatedOrderItems: [{ Id: 1, PerUnitPrice: 12.5, Product: { Name: 'Фільтр' }, Qty: 2 }],
      NetUid: 'order-2',
      Number: 'QAU0000000052',
    })

    expect(screen.getByText('Ціна, EUR')).toBeTruthy()
    expect(screen.getAllByText(/25,00/).length).toBeGreaterThan(0)
  })

  it('uses the document total sent by the server', () => {
    renderOrder({
      Amount: 1234.5,
      DepreciatedOrderItems: [{ Id: 1, PerUnitPrice: 12.5, Product: { Name: 'Фільтр' }, Qty: 2 }],
      NetUid: 'order-3',
      Number: 'QAU0000000053',
    })

    expect(screen.getAllByText(/1.234,50/).length).toBeGreaterThan(0)
  })
})
