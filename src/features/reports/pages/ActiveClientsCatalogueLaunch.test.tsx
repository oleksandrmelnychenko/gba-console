import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getActiveClientsCapabilities } from '../api/activeClientsApi'
import { activeClientsCapability, activeClientsCatalogueEntry } from '../data/activeClients.test-fixtures'
import type { ActiveClientsCapabilities } from '../data/activeClients'
import { ActiveClientsCatalogueLaunch } from './ActiveClientsCatalogueLaunch'

vi.mock('../api/activeClientsApi', () => ({ getActiveClientsCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getActiveClientsCapabilities).mockReset())

function launch(enabled: boolean, open: (capability: ActiveClientsCapabilities) => boolean) {
  return <MantineProvider env="test"><I18nProvider><ActiveClientsCatalogueLaunch report={activeClientsCatalogueEntry()}
    enabled={enabled} disabled={false} onOpen={open} /></I18nProvider></MantineProvider>
}

it('opens the exact catalogue source only after its executable capability arrives', async () => {
  const capability = activeClientsCapability(), open = vi.fn(() => true)
  vi.mocked(getActiveClientsCapabilities).mockResolvedValue(capability)
  render(launch(true, open))
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('does no capability fetch without permission and rejects a late capability after permission loss', async () => {
  const open = vi.fn(() => true)
  let resolve!: (value: ActiveClientsCapabilities) => void
  vi.mocked(getActiveClientsCapabilities).mockReturnValue(new Promise<ActiveClientsCapabilities>(done => { resolve = done }))
  const view = render(launch(false, open))
  expect(getActiveClientsCapabilities).not.toHaveBeenCalled()
  view.rerender(launch(true, open))
  await waitFor(() => expect(getActiveClientsCapabilities).toHaveBeenCalledOnce())
  view.rerender(launch(false, open))
  await act(async () => { resolve(activeClientsCapability()) })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }))
  expect(open).not.toHaveBeenCalled()
})

it('keeps capability failures unavailable and rechecks the server on an explicit retry', async () => {
  const open = vi.fn(() => true)
  vi.mocked(getActiveClientsCapabilities).mockRejectedValueOnce(new Error('Capability unavailable'))
    .mockResolvedValueOnce({ ...activeClientsCapability(), Executable: false })
  render(launch(true, open))
  fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button)
  expect(open).not.toHaveBeenCalled()
})
