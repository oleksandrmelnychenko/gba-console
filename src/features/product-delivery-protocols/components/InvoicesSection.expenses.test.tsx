import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProtocolDetail, SupplyInvoice } from '../detailTypes'
import { getSupplyInvoiceWithSpendings } from '../api/protocolDetailApi'
import { formatDateTime } from './protocolDetailHelpers'
import { InvoicesSection } from './InvoicesSection'

vi.mock('../../../shared/i18n/useI18n', () => {
  const t = (key: string) => key

  return { useI18n: () => ({ t }) }
})

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) => opened ? (
    <section>
      <header>{title}</header>
      {children}
    </section>
  ) : null,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => false }),
}))

vi.mock('../api/protocolDetailApi', () => ({
  getApprovedInvoices: vi.fn(),
  getSupplyInvoiceWithSpendings: vi.fn(),
}))

const getSupplyInvoiceWithSpendingsMock = vi.mocked(getSupplyInvoiceWithSpendings)
const invoiceDate = '2026-08-20T14:30:00'
const invoice: SupplyInvoice = {
  DateFrom: invoiceDate,
  NetUid: 'invoice-8',
  Number: '8',
  SupplyOrder: {
    Client: { FullName: 'SETFREN OTOMOTIV', NetUid: 'supplier-1' },
    ClientAgreement: {
      Agreement: {
        Currency: { Code: 'EUR', NetUid: 'currency-eur' },
      },
    },
    NetUid: 'order-1',
  },
  TotalNetPrice: 200000,
}
const protocol: ProtocolDetail = {
  NetUid: 'protocol-1',
  SupplyInvoices: [invoice],
}

function renderInvoices() {
  render(
    <MantineProvider>
      <InvoicesSection
        permissions={{ canEditAssignments: false, canEditDeliveryDocuments: false }}
        protocol={protocol}
        status={{ isAssigning: false, isSavingInvoiceDocuments: false }}
        onAssignInvoices={vi.fn()}
        onSaveInvoiceDocuments={vi.fn()}
      />
    </MantineProvider>,
  )
}

describe('BUG-1196 invoice expenses information', () => {
  beforeEach(() => {
    getSupplyInvoiceWithSpendingsMock.mockReset()
  })

  it('shows the protocol invoice supplier, number, date, amount, and currency in the exact expenses drawer', async () => {
    getSupplyInvoiceWithSpendingsMock.mockResolvedValueOnce({
      NetUid: 'invoice-8',
      Number: '8',
      SupplyInvoiceBillOfLadingServices: [],
      SupplyInvoiceMergedServices: [],
    })
    renderInvoices()

    fireEvent.click(screen.getByRole('button', { name: 'Детальні витрати' }))

    await waitFor(() => {
      expect(getSupplyInvoiceWithSpendingsMock).toHaveBeenCalledWith('invoice-8')
    })

    const summary = await screen.findByLabelText('Інформація про інвойс')
    const summaryContent = summary.textContent?.replace(/[\u00a0\u202f]/g, ' ') || ''

    expect(within(summary).getByText('Постачальник')).toBeTruthy()
    expect(within(summary).getByText('SETFREN OTOMOTIV')).toBeTruthy()
    expect(within(summary).getByText('Номер інвойса')).toBeTruthy()
    expect(within(summary).getByText('8')).toBeTruthy()
    expect(within(summary).getByText('Дата інвойса')).toBeTruthy()
    expect(within(summary).getByText(formatDateTime(invoiceDate))).toBeTruthy()
    expect(within(summary).getByText('Сума інвойса')).toBeTruthy()
    expect(summaryContent).toContain('200 000,00')
    expect(within(summary).getByText('Валюта інвойса')).toBeTruthy()
    expect(within(summary).getByText('EUR')).toBeTruthy()
  })

  it('keeps rendering the detailed expense service, values, and historical exchange rate', async () => {
    getSupplyInvoiceWithSpendingsMock.mockResolvedValueOnce({
      NetUid: 'invoice-8',
      Number: '8',
      SupplyInvoiceBillOfLadingServices: [],
      SupplyInvoiceMergedServices: [{
        AccountingValue: 4000,
        ExchangeRateEurToAgreementCurrency: 1,
        ExchangeRateEurToUah: 52.13,
        MergedService: {
          ConsumableProduct: { Name: 'послуги брокера' },
          SupplyOrganization: { Name: 'Білий Віктор Васильович ФОП' },
          SupplyOrganizationAgreement: { Currency: { Code: 'UAH' } },
        },
        NetUid: 'expense-1',
        Value: 0,
      }],
    })
    renderInvoices()

    fireEvent.click(screen.getByRole('button', { name: 'Детальні витрати' }))

    expect(await screen.findByText('послуги брокера')).toBeTruthy()
    expect(screen.getByText('Білий Віктор Васильович ФОП')).toBeTruthy()
    expect(screen.getByText('4 000,00 UAH')).toBeTruthy()
    expect(screen.getByText('52,13 UAH')).toBeTruthy()
  })
})
