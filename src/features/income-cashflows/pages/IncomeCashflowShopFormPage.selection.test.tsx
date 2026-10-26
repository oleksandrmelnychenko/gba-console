import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import * as api from '../api/incomeCashflowsApi'
import type { ClientAgreement, Sale } from '../types'
import { IncomeCashflowShopFormPage } from './IncomeCashflowShopFormPage'

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof api>(),
  getIncomeCashflowPaymentMovements: vi.fn(),
  getIncomeCashflowRetailClients: vi.fn(),
  getIncomeCashflowRetailClientAgreements: vi.fn(),
  getIncomeCashflowRetailClientSales: vi.fn(),
  searchIncomeCashflowPaymentMovements: vi.fn(),
  searchIncomeCashflowPaymentRegisters: vi.fn(),
  searchIncomeCashflowRetailClients: vi.fn(),
}))

const clients = [
  { Id: 20248, NetUid: 'ae81848a-88b6-4642-8826-1743f0d7232a', Name: 'test testr', PhoneNumber: '+380966655245' },
  { Id: 20247, NetUid: '141e1c9c-8a26-4dfa-b86a-f90d12a862ff', Name: 'Shop test', PhoneNumber: '+380966009932' },
  { Id: 20246, NetUid: '0ebc927c-e14d-45ea-810a-9d16a56b10d7', Name: 'Uliana QA Engineer Muliar', PhoneNumber: '+380645454545' },
]
const label = `${clients[0].Name} ${clients[0].PhoneNumber}`
const agreements: ClientAgreement[] = [{
  Id: 506856,
  AgreementId: 506878,
  ClientId: 631073,
  Agreement: {
    Id: 506878,
    Name: 'Retail agreement',
    Organization: { Id: 1, Name: 'Retail organization' },
  },
}]

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/accounting/income-cashflows/new/shop']}>
          <IncomeCashflowShopFormPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

async function openClients() {
  const input = await screen.findByRole<HTMLInputElement>('combobox', { name: 'Retail-клієнт' })
  await waitFor(() => expect(input.disabled).toBe(false))
  fireEvent.click(input)
  await screen.findByRole('option', { name: label, hidden: true })
  return input
}

async function passSearchDebounce() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

describe('shop payment selection with the real searchable Select', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.getIncomeCashflowRetailClients).mockResolvedValue(clients)
    vi.mocked(api.getIncomeCashflowRetailClientAgreements).mockResolvedValue(agreements)
    vi.mocked(api.getIncomeCashflowRetailClientSales).mockResolvedValue([])
    vi.mocked(api.getIncomeCashflowPaymentMovements).mockResolvedValue([])
    vi.mocked(api.searchIncomeCashflowPaymentMovements).mockResolvedValue([])
    vi.mocked(api.searchIncomeCashflowPaymentRegisters).mockResolvedValue([])
    vi.mocked(api.searchIncomeCashflowRetailClients).mockResolvedValue([])
  })

  it.each(['agreements', 'sales'] as const)('retains the first selection while %s load beyond the debounce', async (slowRequest) => {
    const pendingAgreements = deferred<ClientAgreement[]>()
    const pendingSales = deferred<Sale[]>()
    if (slowRequest === 'agreements') {
      vi.mocked(api.getIncomeCashflowRetailClientAgreements).mockReturnValueOnce(pendingAgreements.promise)
    } else {
      vi.mocked(api.getIncomeCashflowRetailClientSales).mockReturnValueOnce(pendingSales.promise)
    }
    renderPage()
    const input = await openClients()
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(3)
    fireEvent.click(screen.getByRole('option', { name: label, hidden: true }))

    expect(input.value).toBe(label)
    expect(input.disabled).toBe(true)
    await passSearchDebounce()
    expect(input.value).toBe(label)
    expect(api.searchIncomeCashflowRetailClients).not.toHaveBeenCalled()

    await act(async () => {
      pendingAgreements.resolve(agreements)
      pendingSales.resolve([])
    })
    await waitFor(() => expect(input.disabled).toBe(false))
    expect(input.value).toBe(label)
    expect(api.getIncomeCashflowRetailClientAgreements).toHaveBeenCalledExactlyOnceWith(clients[0].NetUid)
    expect(api.getIncomeCashflowRetailClientSales).toHaveBeenCalledExactlyOnceWith(clients[0].NetUid)
    const organization = screen.getByRole<HTMLInputElement>('combobox', { name: 'Організація' })
    expect(organization.disabled).toBe(false)
    fireEvent.click(organization)
    expect(await screen.findByRole('option', { name: 'Retail organization', hidden: true })).toBeTruthy()
  })

  it('lists all three clients and retains a selection on each of the first three openings', async () => {
    for (let opening = 0; opening < 3; opening += 1) {
      const page = renderPage()
      const input = await openClients()
      expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(3)
      fireEvent.click(screen.getByRole('option', { name: label, hidden: true }))
      await waitFor(() => expect(input.disabled).toBe(false))
      await passSearchDebounce()
      expect(input.value).toBe(label)
      page.unmount()
    }
    expect(api.getIncomeCashflowRetailClients).toHaveBeenCalledTimes(3)
    expect(api.searchIncomeCashflowRetailClients).not.toHaveBeenCalled()
  })

  it('still searches an intentional phone edit and selects the matching different client', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = await openClients()
    fireEvent.click(screen.getByRole('option', { name: label, hidden: true }))
    await waitFor(() => expect(input.disabled).toBe(false))
    vi.mocked(api.searchIncomeCashflowRetailClients).mockResolvedValue([clients[1]])
    await user.clear(input)
    await user.type(input, '380966009932')
    await waitFor(() => expect(api.searchIncomeCashflowRetailClients).toHaveBeenCalledWith('380966009932'))
    const nextLabel = `${clients[1].Name} ${clients[1].PhoneNumber}`
    fireEvent.click(await screen.findByRole('option', { name: nextLabel, hidden: true }))
    await waitFor(() => expect(input.disabled).toBe(false))
    await passSearchDebounce()
    expect(input.value).toBe(nextLabel)
    expect(api.getIncomeCashflowRetailClientAgreements).toHaveBeenLastCalledWith(clients[1].NetUid)
    expect(api.getIncomeCashflowRetailClientSales).toHaveBeenLastCalledWith(clients[1].NetUid)
    expect(api.searchIncomeCashflowRetailClients).toHaveBeenCalledTimes(1)
  })

  it('ignores a search response that arrives after the client was selected', async () => {
    const user = userEvent.setup()
    const search = deferred<typeof clients>()
    vi.mocked(api.searchIncomeCashflowRetailClients).mockReturnValueOnce(search.promise)
    renderPage()
    const input = await openClients()
    await user.type(input, '380966655245')
    await waitFor(() => expect(api.searchIncomeCashflowRetailClients).toHaveBeenCalledWith('380966655245'))
    await user.click(screen.getByRole('option', { name: label, hidden: true }))
    await waitFor(() => expect(input.disabled).toBe(false))
    await act(async () => { search.resolve([]) })
    await passSearchDebounce()

    expect(input.value).toBe(label)
    expect(api.searchIncomeCashflowRetailClients).toHaveBeenCalledTimes(1)
    expect(api.getIncomeCashflowRetailClientAgreements).toHaveBeenCalledExactlyOnceWith(clients[0].NetUid)
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Організація' }).disabled).toBe(false)
  })
})
