import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalBuyerSalesShareCapabilities } from '../api/originalBuyerSalesShareApi'
import { originalBuyerSalesShareCapability, originalBuyerSalesShareCatalogueEntry } from '../data/originalBuyerSalesShare.test-fixtures'
import type { OriginalBuyerSalesShareCapabilities } from '../data/originalBuyerSalesShare'
import { OriginalBuyerSalesShareCatalogueLaunch } from './OriginalBuyerSalesShareCatalogueLaunch'

vi.mock('../api/originalBuyerSalesShareApi', () => ({ getOriginalBuyerSalesShareCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getOriginalBuyerSalesShareCapabilities).mockReset())

function launch(enabled: boolean, open: (capability: OriginalBuyerSalesShareCapabilities) => boolean) {
  return <MantineProvider env="test"><I18nProvider><OriginalBuyerSalesShareCatalogueLaunch report={originalBuyerSalesShareCatalogueEntry()}
    enabled={enabled} disabled={false} onOpen={open} /></I18nProvider></MantineProvider>
}

it('opens the exact catalogue source only after its executable capability arrives', async () => {
  const capability = originalBuyerSalesShareCapability(), open = vi.fn(() => true)
  vi.mocked(getOriginalBuyerSalesShareCapabilities).mockResolvedValue(capability)
  render(launch(true, open))
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(getOriginalBuyerSalesShareCapabilities).toHaveBeenCalledWith('new', expect.any(AbortSignal))
  expect(open).toHaveBeenCalledWith(capability)
})

it('does no capability fetch without permission and rejects a late capability after permission loss', async () => {
  const open = vi.fn(() => true)
  let resolve!: (value: OriginalBuyerSalesShareCapabilities) => void
  vi.mocked(getOriginalBuyerSalesShareCapabilities).mockReturnValue(new Promise<OriginalBuyerSalesShareCapabilities>(done => { resolve = done }))
  const view = render(launch(false, open))
  expect(getOriginalBuyerSalesShareCapabilities).not.toHaveBeenCalled()
  view.rerender(launch(true, open))
  await waitFor(() => expect(getOriginalBuyerSalesShareCapabilities).toHaveBeenCalledOnce())
  view.rerender(launch(false, open))
  await act(async () => { resolve(originalBuyerSalesShareCapability()) })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }))
  expect(open).not.toHaveBeenCalled()
})

it('keeps capability failures unavailable and rechecks the server on an explicit retry', async () => {
  const open = vi.fn(() => true)
  vi.mocked(getOriginalBuyerSalesShareCapabilities).mockRejectedValueOnce(new Error('Capability unavailable'))
    .mockResolvedValueOnce({ ...originalBuyerSalesShareCapability(), Executable: false })
  render(launch(true, open))
  fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button)
  expect(open).not.toHaveBeenCalled()
})

// A source switch must not use the old source's capability, even when it arrives later.
it('discards a late new-buyer capability when the catalogue row changes to repeat buyers', async () => {
  let resolve!: (value: OriginalBuyerSalesShareCapabilities) => void
  const open = vi.fn(() => true), repeat = originalBuyerSalesShareCapability('repeat')
  vi.mocked(getOriginalBuyerSalesShareCapabilities).mockImplementation(variant => variant === 'new'
    ? new Promise<OriginalBuyerSalesShareCapabilities>(done => { resolve = done }) : Promise.resolve(repeat))
  const view = render(launch(true, open))
  await waitFor(() => expect(getOriginalBuyerSalesShareCapabilities).toHaveBeenCalledWith('new', expect.any(AbortSignal)))
  view.rerender(<MantineProvider env="test"><I18nProvider><OriginalBuyerSalesShareCatalogueLaunch report={originalBuyerSalesShareCatalogueEntry('repeat')}
    enabled disabled={false} onOpen={open} /></I18nProvider></MantineProvider>)
  await waitFor(() => expect(getOriginalBuyerSalesShareCapabilities).toHaveBeenCalledWith('repeat', expect.any(AbortSignal)))
  await act(async () => { resolve(originalBuyerSalesShareCapability('new')) })
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(repeat)
})
