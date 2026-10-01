import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCashAggregateBalanceCapabilities } from '../api/cashAggregateBalanceApi'
import { cashAggregateCapability, cashAggregateCatalogueEntry } from '../data/cashAggregateBalance.test-fixtures'
import type { CashAggregateBalanceCapabilities } from '../data/cashAggregateBalance'
import { CashAggregateBalanceCatalogueLaunch } from './CashAggregateBalanceCatalogueLaunch'

vi.mock('../api/cashAggregateBalanceApi', () => ({ getCashAggregateBalanceCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getCashAggregateBalanceCapabilities).mockReset())

function launch(enabled: boolean, open: (capability: CashAggregateBalanceCapabilities) => boolean) {
  return <MantineProvider env="test"><I18nProvider><CashAggregateBalanceCatalogueLaunch report={cashAggregateCatalogueEntry()}
    enabled={enabled} disabled={false} onOpen={open} /></I18nProvider></MantineProvider>
}

it('opens the exact catalogue source only after its executable capability arrives', async () => {
  const capability = cashAggregateCapability(), open = vi.fn(() => true)
  vi.mocked(getCashAggregateBalanceCapabilities).mockResolvedValue(capability)
  render(launch(true, open))
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('does no capability fetch without permission and rejects a late capability after permission loss', async () => {
  const open = vi.fn(() => true)
  let resolve!: (value: CashAggregateBalanceCapabilities) => void
  vi.mocked(getCashAggregateBalanceCapabilities).mockReturnValue(new Promise<CashAggregateBalanceCapabilities>(done => { resolve = done }))
  const view = render(launch(false, open))
  expect(getCashAggregateBalanceCapabilities).not.toHaveBeenCalled()
  view.rerender(launch(true, open))
  await waitFor(() => expect(getCashAggregateBalanceCapabilities).toHaveBeenCalledOnce())
  view.rerender(launch(false, open))
  await act(async () => { resolve(cashAggregateCapability()) })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }))
  expect(open).not.toHaveBeenCalled()
})

it('keeps capability failures unavailable and rechecks the server on an explicit retry', async () => {
  const open = vi.fn(() => true)
  vi.mocked(getCashAggregateBalanceCapabilities).mockRejectedValueOnce(new Error('Capability unavailable'))
    .mockResolvedValueOnce({ ...cashAggregateCapability(), Executable: false })
  render(launch(true, open))
  fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button)
  expect(open).not.toHaveBeenCalled()
})
