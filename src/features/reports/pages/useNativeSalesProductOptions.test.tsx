import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { searchNativeSalesProducts } from '../api/nativeSalesProductLookup'
import { useNativeSalesProductOptions } from './useNativeSalesProductOptions'
vi.mock('../api/nativeSalesProductLookup', () => ({ searchNativeSalesProducts: vi.fn() }))
const api = vi.mocked(searchNativeSalesProducts)
beforeEach(() => {
  api.mockReset()
})
afterEach(cleanup)
it('aborts old query and ignores its delayed success, including invalid raw ID whitespace', async () => {
  let finish!: (value: Awaited<ReturnType<typeof api>>) => void
  api
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValue([{ Id: '2', Name: 'New', VendorCode: '' }])
  const hook = renderHook(({ query }) => useNativeSalesProductOptions('id', query, true), {
    initialProps: { query: '1' },
  })
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  const signal = api.mock.calls[0][1]
  hook.rerender({ query: '1 ' })
  expect(signal?.aborted).toBe(true)
  await act(async () => finish([{ Id: '1', Name: 'Old', VendorCode: '' }]))
  expect(hook.result.current.items).toEqual([])
  expect(api).toHaveBeenCalledOnce()
  hook.rerender({ query: '2' })
  await waitFor(() => expect(hook.result.current.items[0]?.Id).toBe('2'))
  hook.unmount()
  expect(api.mock.calls[1][1]?.aborted).toBe(true)
})
it('restarts catalogue after duplicate cross-page without repeatedly appending duplicate page0', async () => {
  const page = Array.from({ length: 30 }, (_, i) => ({ Id: String(i + 1), Name: 'Item', VendorCode: '' }))
  api
    .mockResolvedValueOnce(page)
    .mockResolvedValueOnce([page[0]])
    .mockResolvedValueOnce([{ Id: '90', Name: 'New', VendorCode: '' }])
  const hook = renderHook(() => useNativeSalesProductOptions('text', 'name', true))
  await waitFor(() => expect(hook.result.current.more).toBe(true))
  act(() => hook.result.current.loadMore())
  await waitFor(() => expect(hook.result.current.error).toContain('Список змінився'))
  expect(hook.result.current.items).toEqual(page)
  act(() => hook.result.current.retry())
  await waitFor(() => expect(hook.result.current.items).toEqual([{ Id: '90', Name: 'New', VendorCode: '' }]))
  expect(api.mock.calls.map((call) => call[0].offset)).toEqual([0, 30, 0])
})

it('invalidates old choices when the same admitted scope is disabled then enabled', async () => {
  api
    .mockResolvedValueOnce([{ Id: '1', Name: 'Old', VendorCode: '' }])
    .mockImplementationOnce(() => new Promise(() => {}))
  const hook = renderHook(({ enabled }) => useNativeSalesProductOptions('id', '1', enabled), {
    initialProps: { enabled: true },
  })
  await waitFor(() => expect(hook.result.current.items[0]?.Id).toBe('1'))
  hook.rerender({ enabled: false })
  expect(hook.result.current.items).toEqual([])
  hook.rerender({ enabled: true })
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2))
  expect(hook.result.current.items).toEqual([])
  expect(hook.result.current.loading).toBe(true)
  hook.unmount()
  expect(api.mock.calls[1][1]?.aborted).toBe(true)
})
