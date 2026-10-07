import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalRevenueCapabilities } from '../api/originalRevenueApi'
import { originalRevenueCapability, originalRevenueCatalogueEntry } from '../data/originalRevenue.test-fixtures'
import type { OriginalRevenueCapabilities } from '../data/originalRevenue'
import { OriginalRevenueCatalogueLaunch } from './OriginalRevenueCatalogueLaunch'

vi.mock('../api/originalRevenueApi', () => ({ getOriginalRevenueCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getOriginalRevenueCapabilities).mockReset())

function launch(enabled: boolean, open: (capability: OriginalRevenueCapabilities) => boolean) {
  return <MantineProvider env="test"><I18nProvider><OriginalRevenueCatalogueLaunch report={originalRevenueCatalogueEntry()}
    enabled={enabled} disabled={false} onOpen={open} /></I18nProvider></MantineProvider>
}

it('opens the exact catalogue source only after its executable capability arrives', async () => {
  const capability = originalRevenueCapability(), open = vi.fn(() => true)
  vi.mocked(getOriginalRevenueCapabilities).mockResolvedValue(capability)
  render(launch(true, open))
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('does no capability fetch without permission and rejects a late capability after permission loss', async () => {
  const open = vi.fn(() => true)
  let resolve!: (value: OriginalRevenueCapabilities) => void
  vi.mocked(getOriginalRevenueCapabilities).mockReturnValue(new Promise<OriginalRevenueCapabilities>(done => { resolve = done }))
  const view = render(launch(false, open))
  expect(getOriginalRevenueCapabilities).not.toHaveBeenCalled()
  view.rerender(launch(true, open))
  await waitFor(() => expect(getOriginalRevenueCapabilities).toHaveBeenCalledOnce())
  view.rerender(launch(false, open))
  await act(async () => { resolve(originalRevenueCapability()) })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }))
  expect(open).not.toHaveBeenCalled()
})

it('keeps capability failures unavailable and rechecks the server on an explicit retry', async () => {
  const open = vi.fn(() => true)
  vi.mocked(getOriginalRevenueCapabilities).mockRejectedValueOnce(new Error('Capability unavailable'))
    .mockResolvedValueOnce({ ...originalRevenueCapability(), Executable: false })
  render(launch(true, open))
  fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button)
  expect(open).not.toHaveBeenCalled()
})
