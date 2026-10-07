import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCurrencyRateDynamicsCapabilities } from '../api/currencyRateDynamicsApi'
import { currencyDynamicsCapability, currencyDynamicsCatalogueEntry } from '../data/currencyRateDynamics.test-fixtures'
import type { CurrencyRateDynamicsCapabilities } from '../data/currencyRateDynamics'
import { CurrencyRateDynamicsCatalogueLaunch } from './CurrencyRateDynamicsCatalogueLaunch'

vi.mock('../api/currencyRateDynamicsApi', () => ({ getCurrencyRateDynamicsCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getCurrencyRateDynamicsCapabilities).mockReset())

function launch(enabled: boolean, open: (capability: CurrencyRateDynamicsCapabilities) => boolean) {
  return <MantineProvider env="test"><I18nProvider><CurrencyRateDynamicsCatalogueLaunch report={currencyDynamicsCatalogueEntry()}
    enabled={enabled} disabled={false} onOpen={open} /></I18nProvider></MantineProvider>
}

it('opens the exact catalogue source only after its executable capability arrives', async () => {
  const capability = currencyDynamicsCapability(), open = vi.fn(() => true)
  vi.mocked(getCurrencyRateDynamicsCapabilities).mockResolvedValue(capability)
  render(launch(true, open))
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('does no capability fetch without permission and rejects a late capability after permission loss', async () => {
  const open = vi.fn(() => true)
  let resolve!: (value: CurrencyRateDynamicsCapabilities) => void
  vi.mocked(getCurrencyRateDynamicsCapabilities).mockReturnValue(new Promise<CurrencyRateDynamicsCapabilities>(done => { resolve = done }))
  const view = render(launch(false, open))
  expect(getCurrencyRateDynamicsCapabilities).not.toHaveBeenCalled()
  view.rerender(launch(true, open))
  await waitFor(() => expect(getCurrencyRateDynamicsCapabilities).toHaveBeenCalledOnce())
  view.rerender(launch(false, open))
  await act(async () => { resolve(currencyDynamicsCapability()) })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }))
  expect(open).not.toHaveBeenCalled()
})

it('keeps capability failures unavailable and rechecks the server on an explicit retry', async () => {
  const open = vi.fn(() => true)
  vi.mocked(getCurrencyRateDynamicsCapabilities).mockRejectedValueOnce(new Error('Capability unavailable'))
    .mockResolvedValueOnce({ ...currencyDynamicsCapability(), Executable: false })
  render(launch(true, open))
  fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button)
  expect(open).not.toHaveBeenCalled()
})
