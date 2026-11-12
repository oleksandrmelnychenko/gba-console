import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { NewUkraineSaleReturnPage } from './NewUkraineSaleReturnPage'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('../../products/components/ProductCardModal', () => ({ ProductCardModal: () => null }))
vi.mock('../../sales-ukraine/persistentSalesMutation', () => ({
  usePersistentSalesMutation: () => vi.fn(),
  SalesPendingMutationRecoveredError: class extends Error {},
}))

const apiMock = vi.mocked(apiRequest)
let childReady: boolean | undefined
let childSale: { IsAcceptedToPacking?: boolean; IsImported?: boolean; IsVatSale?: boolean }

beforeEach(() => {
  vi.clearAllMocks()
  childReady = false
  childSale = {}
  apiMock.mockImplementation(async (path) => {
    if (path === '/sales/all/returns/search') return [
      ['1176741e-9e17-45fb-9ac9-7ac61c1111d5', 'КНо00002560', 'aa43cf38-f8c1-4b9d-807e-cfe8cff78b3e', true],
      ['2f2fa9ff-2ba6-4ea8-927f-e6a1247ed154', 'КНо00002561', '955b3ec2-0ee3-4dbe-a470-bc2238ec941f', childReady],
    ].map(([NetUid, number, itemNetUid, ready]) => ({
      NetUid,
      ...(number === 'КНо00002561' ? childSale : {}),
      SaleNumber: { Value: number },
      ClientAgreement: {
        Client: { NetUid: 'b14c6692-be12-445b-8964-b554b8a808a8', FullName: 'МЕЛЬНИК ЮРІЙ ВІТАЛІЙОВИЧ' },
        Agreement: { Organization: { NetUid: 'adaef157-991d-418a-a205-786d2358c830' }, Currency: { Code: 'UAH' } },
      },
      Order: { OrderItems: [{
        NetUid: itemNetUid,
        Qty: 1,
        ReturnedQty: 0,
        HasCompleteReturnMovement: ready,
        TotalAmountLocal: 3552.824,
        Product: { NetUid: 'b49814ee-f717-4749-bae6-43f46f016c80', VendorCode: 'SEM8059', Name: 'Тяга стабілізатора' },
      }] },
    }))
    if (path === '/sales/returns/vat') return ''
    return []
  })
})

async function search() {
  render(<MantineProvider><I18nProvider><NewUkraineSaleReturnPage /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
  fireEvent.change(await screen.findByLabelText('Артикул'), { target: { value: 'SEM8059' } })
  await screen.findByText('КНо00002561')
  const results = screen.getByRole('region', { name: 'Продажі для повернення' })
  return within(results)
}

it('shows both split invoices with one SEM8059 each and blocks the unposted child', async () => {
  const results = await search()
  expect(results.getAllByText('SEM8059')).toHaveLength(2)
  expect(results.getByText('КНо00002560')).toBeTruthy()
  expect(results.getByText('КНо00002561')).toBeTruthy()
  expect(results.getAllByText('1', { exact: true })).toHaveLength(2)
  expect(results.getByText('Складське проведення не завершено')).toBeTruthy()
  const buttons = results.getAllByText('Додати', { exact: true }).map((label) => label.closest('button')!)
  expect(buttons.map((button) => (button as HTMLButtonElement).disabled)).toEqual([false, true])
  expect(results.getAllByRole('checkbox', { hidden: true }).map((box) => (box as HTMLInputElement).disabled)).toEqual([false, true])
  fireEvent.click(buttons[1])
  expect(screen.queryByText('Позиція повернення')).toBeNull()
  fireEvent.click(buttons[0])
  expect(await screen.findByText('Позиція повернення')).toBeTruthy()
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/sales/returns/vat', {
    query: { netId: 'aa43cf38-f8c1-4b9d-807e-cfe8cff78b3e' },
  }))
  expect(apiMock).toHaveBeenCalledWith('/sales/all/returns/search', expect.objectContaining({
    query: expect.objectContaining({ value: 'SEM8059', includeUnavailable: true }),
  }))
})

it('allows the child invoice once its own reversible stock movement is complete', async () => {
  childReady = true
  const results = await search()
  expect(results.queryByText('Складське проведення не завершено')).toBeNull()
  const buttons = results.getAllByText('Додати', { exact: true }).map((label) => label.closest('button')!)
  expect(buttons.every((button) => !(button as HTMLButtonElement).disabled)).toBe(true)
  fireEvent.click(buttons[1])
  expect(await screen.findByText('Позиція повернення')).toBeTruthy()
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/sales/returns/vat', {
    query: { netId: '955b3ec2-0ee3-4dbe-a470-bc2238ec941f' },
  }))
})

it('does not interpret missing stock readiness as permission to return', async () => {
  childReady = undefined
  const results = await search()
  expect(results.getByText('Складську готовність не підтверджено')).toBeTruthy()
  expect((results.getAllByText('Додати', { exact: true }).map((label) => label.closest('button')!)[1] as HTMLButtonElement).disabled).toBe(true)
})

it.each([
  { name: 'VAT invoice not released for shipment', sale: { IsAcceptedToPacking: false, IsImported: false, IsVatSale: true },
    label: 'Не допущено до відвантаження', hint: /Накладна КНо00002561, до повернення 1\. Накладну ще не допущено до відвантаження.*Оплатіть накладну або розблокуйте її для відвантаження у «Продажі»/ },
  { name: 'non-VAT invoice not released for shipment', sale: { IsAcceptedToPacking: false, IsImported: false, IsVatSale: false },
    label: 'Не допущено до відвантаження', hint: /Накладну ще не допущено до відвантаження.*Повернення стане доступним після оплати накладної\.$/ },
  { name: 'released but stock write-off incomplete', sale: { IsAcceptedToPacking: true, IsImported: false },
    label: 'Складське проведення не завершено', hint: /Накладна КНо00002561, до повернення 1\. Складське списання цієї позиції ще не проведено повністю/ },
  { name: 'imported from 1C without a complete write-off', sale: { IsAcceptedToPacking: true, IsImported: true },
    label: 'Немає складського списання', hint: /Накладна КНо00002561, до повернення 1\. Накладну імпортовано з 1С/ },
])('explains an unavailable row: $name', async ({ sale, label, hint }) => {
  childSale = sale
  const results = await search()
  const status = results.getByText(label)
  expect(results.getByText('КНо00002561')).toBeTruthy()
  fireEvent.mouseEnter(status)
  expect(await screen.findByText(hint)).toBeTruthy()
  expect((results.getAllByText('Додати', { exact: true }).map((item) => item.closest('button')!)[1] as HTMLButtonElement).disabled).toBe(true)
})
