import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MergedService, SupplyInvoiceMergedService } from '../detailTypes'
import { CalculateMergedServicesPanel } from './CalculateMergedServicesPanel'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) => opened ? (
    <div>
      {title}
      {children}
    </div>
  ) : null,
}))

const invoiceService: SupplyInvoiceMergedService = {
  IsCalculatedValue: false,
  NetUid: 'invoice-service-1',
  SupplyInvoice: {
    ExchangeRate: 0,
    ExchangeRateEurToUah: 52.1301,
    NetUid: 'invoice-1',
    Number: '8',
    SupplyOrder: {
      Client: { FullName: 'SETFREN OTOMOTIV', NetUid: 'client-1' },
      NetUid: 'order-1',
    },
  },
}

const service: MergedService = {
  AccountingGrossPrice: 120.25,
  GrossPrice: 125.5,
  IsAutoCalculatedValue: true,
  IsCalculatedValue: false,
  NetUid: 'service-1',
  SupplyExtraChargeType: 0,
  SupplyInvoiceMergedServices: [invoiceService],
  SupplyOrganization: { Name: 'LOGISTICS PARTNER', NetUid: 'supplier-1' },
  SupplyOrganizationAgreement: {
    Currency: { Code: 'EUR', NetUid: 'currency-1' },
    NetUid: 'agreement-1',
  },
}

function renderPanel(currentService: MergedService, onSubmit = vi.fn().mockResolvedValue(null)) {
  render(
    <MantineProvider>
      <CalculateMergedServicesPanel
        isSaving={false}
        opened
        service={currentService}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    </MantineProvider>,
  )

  return onSubmit
}

describe('BUG-1194 merged-service calculation details', () => {
  it('shows the expense source and writes the server-calculated values into the still-open modal', async () => {
    const calculatedService: MergedService = {
      ...service,
      IsCalculatedValue: true,
      SupplyInvoiceMergedServices: [{
        ...invoiceService,
        AccountingValue: 120.25,
        IsCalculatedValue: true,
        Value: 125.5,
      }],
    }
    const onSubmit = renderPanel(service, vi.fn().mockResolvedValue(calculatedService))
    const summary = screen.getByLabelText('Інформація про витрати')

    expect(within(summary).getByText('LOGISTICS PARTNER')).toBeTruthy()
    expect(within(summary).getByText('125,50')).toBeTruthy()
    expect(within(summary).getByText('120,25')).toBeTruthy()
    expect(within(summary).getByText('EUR')).toBeTruthy()
    expect(screen.getByText('SETFREN OTOMOTIV')).toBeTruthy()

    const value = screen.getByLabelText('Вартість') as HTMLInputElement
    const accountingValue = screen.getByLabelText('Вартість (Бух.)') as HTMLInputElement
    expect(value.value).toBe('')
    expect(accountingValue.value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Розрахувати' }))

    await waitFor(() => {
      expect(value.value).toBe('125.5')
      expect(accountingValue.value).toBe('120.25')
    })
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith({
      extraChargeType: 0,
      isAuto: true,
      items: [],
    })
    expect(screen.getByText('Налаштування')).toBeTruthy()
  })

  it('renders confirmed zero allocations as zero instead of missing values', () => {
    renderPanel({
      ...service,
      AccountingGrossPrice: 0,
      GrossPrice: 0,
      IsCalculatedValue: true,
      SupplyInvoiceMergedServices: [{
        ...invoiceService,
        AccountingValue: 0,
        IsCalculatedValue: true,
        Value: 0,
      }],
    })

    expect((screen.getByLabelText('Вартість') as HTMLInputElement).value).toBe('0')
    expect((screen.getByLabelText('Вартість (Бух.)') as HTMLInputElement).value).toBe('0')
  })
})
