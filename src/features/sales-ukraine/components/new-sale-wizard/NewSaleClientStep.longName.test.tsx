import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import postcss from 'postcss'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import type { Client } from '../../../clients/types'
import { NewSaleClientStep } from './NewSaleClientStep'

const { readFileSync } = await vi.importActual<{ readFileSync: (path: string, encoding: 'utf8') => string }>('node:fs')
const wizardCss = readFileSync('src/features/sales-ukraine/components/new-sale-wizard/new-sale-wizard.css', 'utf8')

const fixture = vi.hoisted(() => ({
  client: {
    Id: 628676,
    NetUid: '7afe3139-bb21-4b0f-ae86-17ef3fa6bbb4',
    FullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "АФЕКС АВТОЗАПЧАСТИНИ"',
    RegionCode: { Value: 'BXN02404' },
    IsActive: true,
  },
  sales: [
    {
      NetUid: '86ecb5a0-c5e2-4865-a8f3-36e2395336d5', Created: '2026-10-21T16:23:21',
      TotalCount: 104, TotalAmountLocal: 76768.75000000001,
      SaleNumber: { Value: 'КОк00002149' }, BaseLifeCycleStatus: { SaleLifeCycleType: 2 },
    },
    {
      NetUid: 'f2f2021f-e9c5-4114-bd4f-5a66b00f3231', Created: '2026-10-21T16:23:27',
      TotalCount: 24, TotalAmountLocal: 10586.829999999996,
      SaleNumber: { Value: 'КОк00002150' }, BaseLifeCycleStatus: { SaleLifeCycleType: 2 },
    },
    {
      NetUid: '712ff893-2069-4ba4-8e1b-3fd0bbc79fe5', Created: '2026-10-24T11:37:03',
      TotalCount: 2, TotalAmountLocal: 465.77,
      SaleNumber: { Value: 'КОк00002408' }, BaseLifeCycleStatus: { SaleLifeCycleType: 2 },
    },
    {
      NetUid: '2a1d5712-a76b-4bec-a8ca-cc908981a4cd', Created: '2026-10-28T12:56:29.7066667',
      TotalCount: 2, TotalAmountLocal: 7133.136,
      SaleNumber: { Value: 'КОк00002694' }, BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
    },
  ].map(sale => ({
    ...sale, IsVatSale: true, BaseSalePaymentStatus: { SalePaymentStatusType: 0 },
    ClientAgreement: { ClientId: 628676, Agreement: { Currency: { Code: 'UAH' } } },
  }))
}))

vi.mock('./wizardClientStepApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('./wizardClientStepApi')>(),
  getWizardClientAgreements: async () => [{
    ClientId: 628676, NetUid: 'agreement',
    Agreement: { Name: 'Основний договір', Currency: { Code: 'UAH' }, IsActive: true, PricingId: 847 },
  }],
  getWizardClientGroupedDebts: async () => [{ ClientId: 628676, AgreementId: 503673 }],
  getWizardClientIdentityAttention: async () => null,
  getWizardSalesRegister: async () => fixture.sales.map(Sale => ({ SaleStatistic: { Sale } })),
}))
vi.mock('../../../../shared/realtime/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../../shared/realtime/events')>(),
  useRealtimeEvent: () => {},
}))
vi.mock('../../usePersistentSaleJsonMutation', () => ({
  usePersistentSaleJsonMutationRunner: () => vi.fn(),
}))

const style = document.createElement('style')
beforeEach(() => {
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1200)
})
afterEach(() => {
  style.remove()
  vi.restoreAllMocks()
})

function renderClient(client: Client = fixture.client) {
  style.textContent = postcss.parse(wizardCss).nodes
    .filter(node => node.type === 'rule' && node.selector.startsWith('.new-sale-client-drum'))
    .map(node => node.toString()).join('\n')
  document.head.append(style)
  const onOpenSale = vi.fn()
  const result = render(<MantineProvider><I18nProvider>
    <NewSaleClientStep initialClient={client} clientNetId={client.NetUid ?? null}
      onClientChange={() => {}} onAgreementChange={() => {}} onOpenSale={onOpenSale} />
  </I18nProvider></MantineProvider>)
  return { ...result, onOpenSale }
}

it.each([fixture.client.FullName, 'А'.repeat(300)])('keeps the selected long name inside its sidebar: %s', async FullName => {
  renderClient({ ...fixture.client, FullName })
  const card = await screen.findByTestId('wizard-selected-client')
  const computed = getComputedStyle(card)
  expect(computed.width).toBe('100%')
  expect(computed.minWidth).toBe('0px')
  expect(computed.maxWidth).toBe('100%')
  expect(computed.boxSizing).toBe('border-box')
  const name = within(card).getByText(FullName)
  expect(getComputedStyle(name).whiteSpace).toBe('normal')
  expect(getComputedStyle(name).overflowWrap).toBe('anywhere')
  expect(within(card).getByText('BXN02404')).toBeTruthy()
  await waitFor(() => expect(within(card).getByText('Є борг')).toBeTruthy())
})

it('preserves four BXN02404 documents and expands and opens the first beside the long client name', async () => {
  const { onOpenSale } = renderClient()
  const documentNumber = await screen.findByText('КОк00002694')
  const row = documentNumber.closest('tr')!
  expect(row).toBeTruthy()
  for (const sale of fixture.sales) {
    const saleRow = screen.getByText(sale.SaleNumber.Value).closest('tr')!
    expect(within(saleRow).getByText(String(sale.TotalCount))).toBeTruthy()
    expect(within(saleRow).getByText('UAH')).toBeTruthy()
  }
  expect(await screen.findAllByRole('button', { name: 'Розгорнути' })).toHaveLength(4)
  fireEvent.click(within(row).getByRole('button', { name: 'Розгорнути' }))
  expect(await screen.findByText('Товарів не знайдено')).toBeTruthy()
  expect(onOpenSale).not.toHaveBeenCalled()
  fireEvent.click(within(row).getByRole('button', { name: 'Згорнути' }))
  expect(screen.queryByText('Товарів не знайдено')).toBeNull()
  fireEvent.click(documentNumber)
  await waitFor(() => expect(onOpenSale).toHaveBeenCalledWith(expect.objectContaining({
    NetUid: '2a1d5712-a76b-4bec-a8ca-cc908981a4cd', TotalCount: 2,
  })))
  expect(screen.getByTestId('wizard-selected-client').textContent).toContain(fixture.client.FullName)
})
