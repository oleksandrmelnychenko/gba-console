import { useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getSettlementPeriodAgreements, getSettlementPeriodAvailability } from '../api/settlementPeriodApi'
import { settlementPeriodAgreement as agreement, settlementPeriodScope as scope } from '../data/settlementPeriod.test-fixtures'
import { SettlementPeriodAgreementPicker } from './SettlementPeriodAgreementPicker'

vi.mock('../api/settlementPeriodApi', () => ({ getSettlementPeriodAgreements: vi.fn(), getSettlementPeriodAvailability: vi.fn() }))
const lookup = vi.mocked(getSettlementPeriodAgreements)
const availability = vi.mocked(getSettlementPeriodAvailability)
beforeEach(() => {
  lookup.mockReset()
  availability.mockReset()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

function Harness({ initial, onChange, enabled = true, from = '2026-09-03', to = '2026-09-04' }: {
  initial?: unknown; onChange: (value: unknown) => void; enabled?: boolean; from?: string; to?: string
}) {
  const [value, setValue] = useState(initial)
  return <MantineProvider env="test"><SettlementPeriodAgreementPicker value={value} from={from} to={to} enabled={enabled} disabled={false}
    onChange={next => { setValue(next); onChange(next) }} /></MantineProvider>
}

it('checks one selected exact period only on action and aborts a stale check when scope changes', async () => {
  lookup.mockResolvedValue([agreement])
  let finish!: (value: boolean) => void
  availability.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const changed = vi.fn()
  render(<Harness initial={scope} onChange={changed} />)
  await waitFor(() => expect(lookup).toHaveBeenCalledOnce())
  expect(availability).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Перевірити покриття періоду' }))
  expect(availability).toHaveBeenCalledWith(scope, '2026-09-03', '2026-09-04', expect.any(AbortSignal))
  const signal = availability.mock.calls[0][3]!
  await choose('База обліку договору', 'AMG')
  expect(signal.aborted).toBe(true)
  await act(async () => finish(true))
  expect(screen.queryByText(/Повна публікація доступна/)).toBeNull()
})

it('shows unavailable coverage without presenting an unverified agreement as ready', async () => {
  lookup.mockResolvedValue([agreement]); availability.mockResolvedValue(false)
  render(<Harness initial={scope} onChange={vi.fn()} />)
  expect(availability).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Перевірити покриття періоду' }))
  expect(await screen.findByText(/немає повної чинної публікації/)).toBeTruthy()
  expect(screen.queryByText(/Повна публікація доступна/)).toBeNull()
})
async function choose(label: string, option: string | RegExp) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  const item = await screen.findByRole('option', { name: option })
  await act(async () => fireEvent.click(item))
}

it('does no lookup until both explicit world and family are chosen, then selects exact identity', async () => {
  lookup.mockResolvedValue([agreement])
  const changed = vi.fn()
  render(<Harness onChange={changed} />)
  expect(lookup).not.toHaveBeenCalled()
  await choose('База обліку договору', 'Fenix')
  expect(lookup).not.toHaveBeenCalled()
  await choose('Тип договору', 'Договір контрагента')
  await choose('Договір і валюта взаєморозрахунків', /Synthetic organization/)
  expect(changed).toHaveBeenLastCalledWith(scope)
  expect(lookup).toHaveBeenCalledWith('Fenix', 'ClientAgreement', '0', 30, expect.any(AbortSignal))
})

it.each([
  ['База обліку договору', 'AMG', 'Amg', 'ClientAgreement'],
  ['Тип договору', 'Договір організації постачальника', 'Fenix', 'SupplyOrganizationAgreement'],
])('clears both exact identity fields when changing %s and cancels the old lookup', async (label, option, world, family) => {
  lookup.mockResolvedValue([])
  const changed = vi.fn()
  render(<Harness initial={scope} onChange={changed} />)
  await waitFor(() => expect(lookup).toHaveBeenCalledOnce())
  const oldSignal = lookup.mock.calls[0][4]
  await choose(label, option)
  expect(changed).toHaveBeenLastCalledWith({ Version: 1, CurrencyBasis: 'SettlementCurrency', SourceWorld: world, NativeFamily: family })
  expect(oldSignal?.aborted).toBe(true)
  await waitFor(() => expect(lookup).toHaveBeenLastCalledWith(world, family, '0', 30, expect.any(AbortSignal)))
})

it('retains a saved identity during lookup failure and warns on a replacement without automatic adoption', async () => {
  lookup.mockRejectedValueOnce(new Error('Unavailable'))
  const changed = vi.fn()
  render(<Harness initial={scope} onChange={changed} />)
  expect(await screen.findByText(/Не вдалося завантажити точні договори/)).toBeTruthy()
  expect(screen.getByDisplayValue(/Збережений договір ID/)).toBeTruthy()
  lookup.mockResolvedValueOnce([{ ...agreement, AgreementNetUid: '87654321-1234-1234-1234-1234567890ab' }])
  fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
  expect(await screen.findByText(/Ідентичність збереженого договору змінилася/)).toBeTruthy()
  expect(changed).not.toHaveBeenCalled()
})

it('ignores a late next page after the world changes, including its old captions and identities', async () => {
  const page = Array.from({ length: 30 }, (_, i) => ({ ...agreement, AgreementId: String(i + 1) }))
  let complete!: (rows: typeof page) => void
  lookup.mockResolvedValueOnce(page).mockImplementationOnce(() => new Promise(resolve => { complete = resolve })).mockResolvedValueOnce([])
  const changed = vi.fn()
  render(<Harness initial={scope} onChange={changed} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Завантажити ще договори' }))
  expect(lookup).toHaveBeenLastCalledWith('Fenix', 'ClientAgreement', '30', 30, expect.any(AbortSignal))
  await choose('База обліку договору', 'AMG')
  await act(async () => complete([{ ...agreement, AgreementName: 'STALE WORLD AGREEMENT' }]))
  fireEvent.click(screen.getByRole('combobox', { name: 'Договір і валюта взаєморозрахунків' }))
  expect(screen.queryByRole('option', { name: /STALE WORLD/ })).toBeNull()
  expect(changed).toHaveBeenLastCalledWith({ Version: 1, CurrencyBasis: 'SettlementCurrency', SourceWorld: 'Amg', NativeFamily: 'ClientAgreement' })
})

it('makes no lookup when server/report permission gate is disabled', () => {
  render(<Harness initial={scope} onChange={vi.fn()} enabled={false} />)
  expect(lookup).not.toHaveBeenCalled()
  expect((screen.getByRole('combobox', { name: 'База обліку договору' }) as HTMLInputElement).disabled).toBe(true)
})


it('clears loading after a rejected next page and keeps the selected identity for retry', async () => {
  const page = Array.from({ length: 30 }, (_, i) => ({ ...agreement, AgreementId: String(i + 1) }))
  lookup.mockResolvedValueOnce(page).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([])
  const changed = vi.fn()
  render(<Harness initial={scope} onChange={changed} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Завантажити ще договори' }))
  expect(await screen.findByText(/Наступну сторінку договорів не отримано/)).toBeTruthy()
  await waitFor(() => expect((screen.getByRole('button', { name: 'Завантажити ще договори' }) as HTMLButtonElement).disabled).toBe(false))
  expect(changed).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Завантажити ще договори' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Завантажити ще договори' })).toBeNull())
  expect(lookup).toHaveBeenLastCalledWith('Fenix', 'ClientAgreement', '30', 30, expect.any(AbortSignal))
})
