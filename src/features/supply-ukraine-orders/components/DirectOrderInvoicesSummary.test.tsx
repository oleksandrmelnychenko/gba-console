import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DirectSupplyOrder } from '../types'
import { DirectOrderInvoicesSummary } from './DirectOrderInvoicesSummary'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('DirectOrderInvoicesSummary', () => {
  it('shows the attached invoice facts and documents on the logistics path', () => {
    renderSummary({
      ClientAgreement: {
        Agreement: {
          Currency: { Code: 'USD' },
        },
      },
      SupplyInvoices: [
        {
          DateFrom: '2026-08-25T03:00:00',
          InvoiceDocuments: [
            {
              DocumentUrl: 'http://files.example.test/invoice.jpg',
              FileName: 'invoice.jpg',
              NetUid: '890bc878-7c89-4052-8875-c55b4122d230',
            },
            {
              Deleted: true,
              FileName: 'deleted.pdf',
              NetUid: '55ec3d6c-4004-4c64-85d3-558c63455d1e',
            },
          ],
          NetUid: 'f7c7de11-1c08-4835-8a69-d217b808a53e',
          Number: 'INV-2435-A',
          SupplyInvoiceDeliveryDocuments: [
            {
              DocumentUrl: 'http://files.example.test/invoice.jpg',
              FileName: 'invoice.jpg',
              NetUid: '890bc878-7c89-4052-8875-c55b4122d230',
            },
          ],
          TotalNetPrice: 31439.43,
          TotalNetPriceWithVat: 37727.32,
          TotalQuantity: 47,
          TotalVatAmount: 6287.89,
        },
      ],
    })

    const invoice = screen.getByRole('group', { name: 'Інвойс INV-2435-A' })

    expect(within(invoice).getByText('INV-2435-A')).not.toBeNull()
    expect(within(invoice).getByText(/25\.08\.26/)).not.toBeNull()
    expect(within(invoice).getByText('USD')).not.toBeNull()
    expect(within(invoice).getByText('47')).not.toBeNull()
    expect(within(invoice).getByText(/31\s439,43/)).not.toBeNull()
    expect(within(invoice).getByText(/6\s287,89/)).not.toBeNull()
    expect(within(invoice).getByText(/37\s727,32/)).not.toBeNull()
    expect(within(invoice).getByRole('link', { name: 'invoice.jpg' }).getAttribute('href'))
      .toBe('http://files.example.test/invoice.jpg')
    expect(within(invoice).queryAllByRole('link', { name: 'invoice.jpg' })).toHaveLength(1)
    expect(within(invoice).queryByText('deleted.pdf')).toBeNull()
  })

  it('shows every attached invoice independently', () => {
    renderSummary({
      SupplyInvoices: [
        {
          NetUid: 'a7c7de11-1c08-4835-8a69-d217b808a53e',
          Number: 'INV-2435-A',
          TotalNetPrice: 100.01,
        },
        {
          NetUid: 'b7c7de11-1c08-4835-8a69-d217b808a53e',
          Number: 'INV-2435-B',
          TotalNetPrice: 200.02,
        },
      ],
    })

    const firstInvoice = screen.getByRole('group', { name: 'Інвойс INV-2435-A' })
    const secondInvoice = screen.getByRole('group', { name: 'Інвойс INV-2435-B' })

    expect(within(firstInvoice).getByRole('group', { name: 'Сума нетто' }).textContent).toContain('100,01')
    expect(within(secondInvoice).getByRole('group', { name: 'Сума нетто' }).textContent).toContain('200,02')
  })

  it('renders no invoice block before an invoice is attached', () => {
    renderSummary({ SupplyInvoices: [] })

    expect(screen.queryByText('Інвойс')).toBeNull()
    expect(screen.queryByText('Документів немає')).toBeNull()
  })
})

function renderSummary(order: DirectSupplyOrder) {
  render(
    <MantineProvider env="test">
      <DirectOrderInvoicesSummary order={order} />
    </MantineProvider>,
  )
}
