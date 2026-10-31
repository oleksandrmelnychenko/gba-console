import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { searchNativeSalesProducts } from '../api/nativeSalesProductLookup'
import { searchNativeReportProducts } from '../api/nativeReportProductLookup'
import type { ReportProductLookupSource } from '../data/productLookupCapability'
import { useNativeSalesProductOptions } from './useNativeSalesProductOptions'
vi.mock('../api/nativeSalesProductLookup', () => ({ searchNativeSalesProducts: vi.fn() }))
vi.mock('../api/nativeReportProductLookup', () => ({ searchNativeReportProducts: vi.fn() }))
const shared = vi.mocked(searchNativeReportProducts), legacy = vi.mocked(searchNativeSalesProducts)
beforeEach(() => { shared.mockReset(); legacy.mockReset() })
afterEach(cleanup)
it('aborts an old report owner and ignores its delayed same-ID response under another report', async () => {
  let finish!: (items: Awaited<ReturnType<typeof shared>>) => void
  shared.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce([{ Id: '9007199254740993', Name: 'Report44', VendorCode: 'B' }])
  const hook = renderHook(({ source }) => useNativeSalesProductOptions('id', '9007199254740993', true, source), { initialProps: { source: 3 as ReportProductLookupSource } })
  await waitFor(() => expect(shared).toHaveBeenCalledOnce());const oldSignal = shared.mock.calls[0][2]
  hook.rerender({ source: 44 });expect(oldSignal?.aborted).toBe(true)
  await waitFor(() => expect(hook.result.current.items[0]?.Name).toBe('Report44'))
  await act(async () => finish([{ Id: '9007199254740993', Name: 'Old report3', VendorCode: 'A' }]))
  expect(hook.result.current.items[0]?.Name).toBe('Report44');expect(shared.mock.calls.map(call => call[0])).toEqual([3, 44]);expect(legacy).not.toHaveBeenCalled()
  hook.unmount();expect(shared.mock.calls[1][2]?.aborted).toBe(true)
})
it('does not resurrect old source3 options after source3→source45→source3 with pending replacements', async () => {
  shared.mockResolvedValueOnce([{ Id: '1', Name: 'Old3', VendorCode: '' }]).mockImplementation(() => new Promise(() => {}))
  const hook = renderHook(({ source }) => useNativeSalesProductOptions('text', 'query', true, source), { initialProps: { source: 3 as ReportProductLookupSource } })
  await waitFor(() => expect(hook.result.current.items[0]?.Name).toBe('Old3'))
  hook.rerender({ source: 45 });await waitFor(() => expect(shared).toHaveBeenCalledTimes(2));expect(hook.result.current.items).toEqual([])
  hook.rerender({ source: 3 });await waitFor(() => expect(shared).toHaveBeenCalledTimes(3));expect(hook.result.current.items).toEqual([]);expect(hook.result.current.loading).toBe(true)
})
it('separates the existing source2 legacy transport from the new shared source2 context', async () => {
  legacy.mockResolvedValue([{ Id: '1', Name: 'Legacy', VendorCode: '' }]);shared.mockResolvedValue([{ Id: '2', Name: 'Shared', VendorCode: '' }])
  const hook = renderHook(({ source }) => useNativeSalesProductOptions('text', '', true, source), { initialProps: { source: undefined as ReportProductLookupSource | undefined } })
  await waitFor(() => expect(hook.result.current.items[0]?.Name).toBe('Legacy'));const signal = legacy.mock.calls[0][1]
  hook.rerender({ source: 2 });expect(signal?.aborted).toBe(true)
  await waitFor(() => expect(hook.result.current.items[0]?.Name).toBe('Shared'));expect(shared.mock.calls[0][0]).toBe(2)
})
it('retains two paged string-identity batches above2^53 under the same report and literal query', async () => {
  const first = Array.from({ length: 30 }, (_, i) => ({ Id: String(9007199254740993n + BigInt(i)), Name: 'Item', VendorCode: 'SKU'+i }))
  const last = { Id: '9007199254741023', Name: 'Next', VendorCode: 'NEXT' }
  shared.mockImplementation(async (_source, query) => query.offset === 0 ? first : [last])
  const hook = renderHook(() => useNativeSalesProductOptions('text', 'SEM', true, 3))
  await waitFor(() => expect(hook.result.current.more).toBe(true));act(() => hook.result.current.loadMore())
  await waitFor(() => expect(hook.result.current.items).toHaveLength(31));expect(hook.result.current.items[30]).toEqual(last)
  expect(shared.mock.calls.map(call => [call[0], call[1]])).toEqual([[3, { value: 'SEM', offset: 0, limit: 30 }], [3, { value: 'SEM', offset: 30, limit: 30 }]])
  expect(hook.result.current.more).toBe(false)
})
it('shows a shared authorization error without a legacy fallback and retries only the same owner explicitly', async () => {
  shared.mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce([])
  const hook = renderHook(() => useNativeSalesProductOptions('text', 'SEM14631', true, 3))
  await waitFor(() => expect(hook.result.current.error).toBeTruthy());expect(shared).toHaveBeenCalledOnce();expect(legacy).not.toHaveBeenCalled()
  act(() => hook.result.current.retry());await waitFor(() => expect(shared).toHaveBeenCalledTimes(2));expect(shared.mock.calls.map(call => call[0])).toEqual([3,3]);expect(legacy).not.toHaveBeenCalled()
})
it('invalidates an admitted report scope when disabled and never restores its previous items on enable', async () => {
  shared.mockResolvedValueOnce([{ Id: '1', Name: 'Old', VendorCode: '' }]).mockImplementationOnce(() => new Promise(() => {}))
  const hook = renderHook(({ enabled }) => useNativeSalesProductOptions('text', '', enabled, 46), { initialProps: { enabled: true } })
  await waitFor(() => expect(hook.result.current.items[0]?.Name).toBe('Old'));const signal = shared.mock.calls[0][2]
  hook.rerender({ enabled: false });expect(signal?.aborted).toBe(true);expect(hook.result.current.items).toEqual([])
  hook.rerender({ enabled: true });await waitFor(() => expect(shared).toHaveBeenCalledTimes(2));expect(hook.result.current.items).toEqual([])
})
