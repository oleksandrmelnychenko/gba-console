import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import type { ClientOrderedProduct } from '../../../clients/types'
import { WizardOrderedProductsDrawer } from './WizardOrderedProductsDrawer'

const load = vi.hoisted(() => vi.fn())
vi.mock('../../../clients/api/clientCabinetApi', () => ({ getClientOrderedProducts: load }))
vi.mock('../../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ opened, children }: { opened: boolean; children: ReactNode }) => opened ? <div role="dialog">{children}</div> : null,
}))
beforeEach(() => { vi.useFakeTimers(); load.mockReset().mockResolvedValue([]) })
afterEach(() => { cleanup(); vi.useRealTimers() })
const close = () => {}
function view(opened: boolean, clientNetId: string | null = 'client-a') {
  return <MantineProvider><I18nProvider><WizardOrderedProductsDrawer opened={opened} clientNetId={clientNetId} onClose={close} /></I18nProvider></MantineProvider>
}
async function tick() { await act(() => vi.advanceTimersByTimeAsync(0)) }
function deferred() {
  let resolve!: (products: ClientOrderedProduct[]) => void
  const promise = new Promise<ClientOrderedProduct[]>(next => { resolve = next })
  return { promise, resolve }
}

it('reuses a pending read through closing and reopening, then refreshes on a later opening', async () => {
  const pending = deferred()
  load.mockReturnValueOnce(pending.promise)
  const { rerender } = render(view(true))
  await tick()
  rerender(view(false))
  rerender(view(true))
  await tick()
  expect(load).toHaveBeenCalledOnce()
  await act(async () => pending.resolve([{ ProductName: 'Current order', Qty: 2 }]))
  expect(screen.getByText('Current order')).toBeTruthy()
  rerender(view(false))
  rerender(view(true))
  await tick()
  expect(load).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Current order')).toBeNull()
})

it('aborts a closed drawer request on client change and rejects its late response', async () => {
  const pending = deferred()
  load.mockReturnValueOnce(pending.promise)
  const { rerender, unmount } = render(view(true))
  await tick()
  const signal = load.mock.calls[0][1] as AbortSignal
  rerender(view(false))
  rerender(view(false, 'client-b'))
  expect(signal?.aborted).toBe(true)
  rerender(view(true, 'client-b'))
  await tick()
  await act(async () => pending.resolve([{ ProductName: 'Retired order' }]))
  expect(screen.queryByText('Retired order')).toBeNull()
  expect(screen.getByText('Товарів не знайдено')).toBeTruthy()
  const currentSignal = load.mock.calls[1][1] as AbortSignal
  unmount()
  expect(currentSignal.aborted).toBe(true)
})

it('does not load closed or missing-client drawers and retries a failed opening', async () => {
  const { rerender } = render(view(false))
  rerender(view(true, null))
  await tick()
  expect(load).not.toHaveBeenCalled()
  load.mockRejectedValueOnce(new Error('Offline'))
  rerender(view(true))
  await tick()
  expect(screen.getByText('Offline')).toBeTruthy()
  rerender(view(false))
  rerender(view(true))
  await tick()
  expect(screen.queryByText('Offline')).toBeNull()
  expect(load).toHaveBeenCalledTimes(2)
})
