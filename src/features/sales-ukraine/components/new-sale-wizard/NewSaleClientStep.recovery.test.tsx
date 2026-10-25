import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import type { ClientAgreement, ClientInDebt } from '../../../clients/types'

const mocks = vi.hoisted(() => ({ agreements: vi.fn(), debts: vi.fn(), register: vi.fn() }))
vi.mock('./wizardClientStepApi', async importOriginal => ({
  ...await importOriginal<typeof import('./wizardClientStepApi')>(),
  getWizardClientAgreements: mocks.agreements,
  getWizardClientGroupedDebts: mocks.debts,
  getWizardClientIdentityAttention: vi.fn(async () => null),
  getWizardSalesRegister: mocks.register,
}))
vi.mock('../../../../shared/realtime/events', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../shared/realtime/events')>(), useRealtimeEvent: () => {},
}))
vi.mock('../../usePersistentSaleJsonMutation', () => ({ usePersistentSaleJsonMutationRunner: () => vi.fn() }))
import { NewSaleClientStep } from './NewSaleClientStep'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
beforeEach(() => {
  mocks.agreements.mockReset()
  mocks.debts.mockReset()
  mocks.register.mockReset().mockResolvedValue([])
})

it('offers independent agreement, debt and register retries while retaining successful sections', async () => {
  const slowDebt = deferred<ClientInDebt[]>()
  const agreements = deferred<ClientAgreement[]>()
  mocks.agreements.mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(agreements.promise)
  mocks.debts.mockReturnValueOnce(slowDebt.promise).mockResolvedValueOnce([{ Debt: { Total: 15 } }])
  mocks.register.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
  const client = { Id: 1, NetUid: 'client-1', FullName: 'Клієнт', RegionCode: { Value: 'CN00001' } }
  render(<MantineProvider><I18nProvider>
    <NewSaleClientStep initialClient={client} clientNetId="client-1" onClientChange={() => {}}
      onAgreementChange={() => {}} onOpenSale={() => {}} />
  </I18nProvider></MantineProvider>)
  const retry = await screen.findByRole('button', { name: 'Повторити завантаження договорів' })
  expect(screen.queryByText('Договорів не знайдено')).toBeNull()
  expect(screen.getByText('Завантаження боргів')).toBeTruthy()
  fireEvent.click(retry)
  fireEvent.click(retry)
  expect(mocks.agreements).toHaveBeenCalledTimes(2)
  expect((retry as HTMLButtonElement).disabled).toBe(true)
  expect(mocks.debts).toHaveBeenCalledOnce()
  await act(async () => agreements.resolve([{ NetUid: 'agreement-1', Agreement: { IsActive: true, Name: 'Успішний договір' } }]))
  expect(await screen.findByText('Успішний договір')).toBeTruthy()
  await act(async () => slowDebt.reject(new Error('offline')))
  expect(screen.getByText('Не вдалося завантажити борги. Відсутність боргу не підтверджено.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Повторити завантаження боргів' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Повторити завантаження боргів' })).toBeNull())
  expect(screen.getAllByText('Є борг').length).toBeGreaterThan(0)
  expect(mocks.register).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Повторити завантаження' }))
  await waitFor(() => expect(screen.queryAllByRole('alert')).toHaveLength(0))
  expect(mocks.register).toHaveBeenCalledTimes(2)
  expect(mocks.agreements).toHaveBeenCalledTimes(2)
  expect(mocks.debts).toHaveBeenCalledTimes(2)
  expect(screen.getByText('Успішний договір')).toBeTruthy()
})
