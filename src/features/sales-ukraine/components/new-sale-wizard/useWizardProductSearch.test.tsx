import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WizardSaleProduct } from './wizardSaleProduct'

const mocks = vi.hoisted(() => ({
  recommendations: vi.fn(),
  search: vi.fn(),
  notify: vi.fn(),
  t: (value: string) => value,
}))
vi.mock('./newSaleWizardApi', () => ({ searchSaleProductsWithAvailability: mocks.search }))
vi.mock('../../../clients/api/clientRecommendationsApi', () => ({ getMostPurchasedProductsByClientId: mocks.recommendations }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))

import { initializeWizardKeyboard, setWizardKeyboardState } from './wizardKeyboard'
import { useWizardProductSearch } from './useWizardProductSearch'

const product = (id: string): WizardSaleProduct => ({ NetUid: id, VendorCode: id })

function deferred() {
  let resolve!: (value: WizardSaleProduct[]) => void
  const promise = new Promise<WizardSaleProduct[]>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

function setup() {
  const onResetSelection = vi.fn()
  const onResults = vi.fn()
  const hook = renderHook((props) => useWizardProductSearch({ ...props, onResetSelection, onResults }), {
    initialProps: { agreementNetId: 'agreement-1', clientNetId: 'client-1' },
  })
  return { ...hook, onResetSelection, onResults }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.search.mockReset().mockResolvedValue([])
  mocks.recommendations.mockReset().mockResolvedValue([])
  initializeWizardKeyboard(1)
  setWizardKeyboardState('ProductSearch')
})

describe('wizard product search lifecycle', () => {
  it('keeps an identical pending query alive and ignores whitespace-only query and settings changes', async () => {
    const pending = deferred()
    mocks.search.mockReturnValueOnce(pending.promise)
    const { result, onResetSelection } = setup()
    act(() => result.current.handleQueryChange('parts'))
    const signal = mocks.search.mock.calls[0][2].signal as AbortSignal
    act(() => result.current.handleQueryChange('parts'))
    act(() => result.current.handleQueryChange(' parts '))
    act(() => result.current.handleSearchSettingsChange('5', '2'))
    expect(signal.aborted).toBe(false)
    expect(mocks.search).toHaveBeenCalledOnce()
    expect(onResetSelection).toHaveBeenCalledOnce()
    await act(async () => pending.resolve([product('a')]))
    expect(result.current.isSearching).toBe(false)
    const before = result.current.results
    act(() => result.current.handleQueryChange('parts'))
    expect(result.current.results).toBe(before)
    expect(mocks.search).toHaveBeenCalledOnce()
  })

  it('does not restart requests when result callbacks change and uses the latest callback', async () => {
    const pending = deferred()
    mocks.search.mockReturnValueOnce(pending.promise)
    const first = vi.fn(), latest = vi.fn()
    const { result, rerender } = renderHook(({ onResults }) => useWizardProductSearch({
      agreementNetId: 'agreement-1', clientNetId: 'client-1', onResetSelection: () => {}, onResults,
    }), { initialProps: { onResults: first } })
    act(() => result.current.handleQueryChange('parts'))
    const signal = mocks.search.mock.calls[0][2].signal as AbortSignal
    rerender({ onResults: latest })
    expect(signal.aborted).toBe(false)
    expect(mocks.search).toHaveBeenCalledOnce()
    await act(async () => pending.resolve([product('parts')]))
    expect(latest).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('ignores a late search response after a newer query finishes', async () => {
    const oldSearch = deferred()
    mocks.search.mockReturnValueOnce(oldSearch.promise).mockResolvedValueOnce([product('new')])
    const { result, onResults } = setup()
    act(() => result.current.handleQueryChange('old'))
    const oldSignal = mocks.search.mock.calls[0][2].signal as AbortSignal
    act(() => result.current.handleQueryChange('new'))
    await waitFor(() => expect(result.current.results).toEqual([product('new')]))
    expect(oldSignal.aborted).toBe(true)
    await act(async () => oldSearch.resolve([product('old')]))
    expect(result.current.results).toEqual([product('new')])
    expect(onResults).toHaveBeenCalledTimes(1)
  })

  it.each(['clientNetId', 'agreementNetId'] as const)('retires recommendations on %s change', async (field) => {
    const pending = deferred()
    mocks.recommendations.mockReturnValueOnce(pending.promise)
    const { result, rerender, onResults, onResetSelection } = setup()
    let request!: Promise<boolean>
    act(() => { request = result.current.loadClientRecommendations() })
    const signal = mocks.recommendations.mock.calls[0][2].signal as AbortSignal
    rerender({ agreementNetId: 'agreement-1', clientNetId: 'client-1', [field]: 'new-context' })
    expect(signal.aborted).toBe(true)
    expect(result.current.isLoadingRecommendations).toBe(false)
    expect(onResetSelection).toHaveBeenCalledOnce()
    await act(async () => pending.resolve([product('stale')]))
    expect(await request).toBe(false)
    expect(result.current.results).toEqual([])
    expect(onResults).not.toHaveBeenCalled()
  })

  it('retires an outstanding page and clears selection when the agreement changes', async () => {
    const page = deferred()
    mocks.search.mockResolvedValueOnce([product('first')]).mockReturnValueOnce(page.promise)
    const { result, rerender, onResetSelection } = setup()
    act(() => result.current.handleQueryChange('first'))
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    setWizardKeyboardState('ProductSelection')
    act(() => { void result.current.loadMoreResults() })
    const signal = mocks.search.mock.calls[1][2].signal as AbortSignal
    rerender({ agreementNetId: 'agreement-2', clientNetId: 'client-1' })
    expect(signal.aborted).toBe(true)
    expect(result.current.results).toEqual([])
    expect(result.current.query).toBe('')
    expect(onResetSelection).toHaveBeenCalledTimes(2)
    await act(async () => page.resolve([product('stale-page')]))
    expect(result.current.results).toEqual([])
  })

  it('deduplicates overlapping pages and advances by received rows', async () => {
    mocks.search
      .mockResolvedValueOnce([product('a'), product('b')])
      .mockResolvedValueOnce([product('b'), product('c'), product('c')])
      .mockResolvedValueOnce([product('c')])
      .mockResolvedValueOnce([])
    const { result } = setup()
    act(() => result.current.handleQueryChange('parts'))
    await waitFor(() => expect(result.current.results).toHaveLength(2))
    await act(async () => { await result.current.loadMoreResults() })
    expect(result.current.results.map((item) => item.NetUid)).toEqual(['a', 'b', 'c'])
    await act(async () => { await result.current.loadMoreResults() })
    await act(async () => { await result.current.loadMoreResults() })
    await act(async () => { await result.current.loadMoreResults() })
    expect(mocks.search.mock.calls.map((call) => call[2].offset)).toEqual([0, 2, 5, 6])
  })

  it('allows only one page request at a time and retries a failed page at the same offset', async () => {
    const page = deferred()
    mocks.search.mockResolvedValueOnce([product('a')]).mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(page.promise)
    const { result } = setup()
    act(() => result.current.handleQueryChange('parts'))
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    await act(async () => { await result.current.loadMoreResults() })
    act(() => { void result.current.loadMoreResults(); void result.current.loadMoreResults() })
    expect(mocks.search).toHaveBeenCalledTimes(3)
    expect(mocks.search.mock.calls.map((call) => call[2].offset)).toEqual([0, 1, 1])
    expect(mocks.notify).toHaveBeenCalledWith({ color: 'red', message: 'offline' })
    await act(async () => page.resolve([product('b')]))
    expect(result.current.results).toEqual([product('a'), product('b')])
  })

  it('preserves embedded search results and exact-code selection', async () => {
    const exact = product('exact')
    mocks.search.mockResolvedValueOnce([{ ...product('first'), NextSearchedProducts: [exact] }])
    const { result, onResults } = setup()
    act(() => result.current.handleQueryChange('exact'))
    await waitFor(() => expect(result.current.results).toHaveLength(2))
    expect(onResults).toHaveBeenCalledWith({ index: 1, product: exact })
    await act(async () => { await result.current.loadMoreResults() })
    expect(mocks.search.mock.calls[1][2].offset).toBe(2)
  })

  it('does not let an old recommendation request clear the loading state of a new search', async () => {
    const recommendation = deferred()
    const search = deferred()
    mocks.recommendations.mockReturnValueOnce(recommendation.promise)
    mocks.search.mockReturnValueOnce(search.promise)
    const { result } = setup()
    act(() => { void result.current.loadClientRecommendations() })
    act(() => result.current.handleQueryChange('parts'))
    await act(async () => recommendation.resolve([product('stale')]))
    expect(result.current.isSearching).toBe(true)
    expect(result.current.isLoadingRecommendations).toBe(false)
    await act(async () => search.resolve([product('current')]))
    expect(result.current.isSearching).toBe(false)
    expect(result.current.results).toEqual([product('current')])
  })

  it('retries the same query and allows settings changes from product selection', async () => {
    mocks.search.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([product('a')])
    const { result } = setup()
    act(() => result.current.handleQueryChange('parts'))
    await waitFor(() => expect(result.current.searchError).toBe('offline'))
    act(() => result.current.retryProductSearch())
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(result.current.searchError).toBeNull()
    setWizardKeyboardState('ProductSelection')
    act(() => result.current.handleSearchSettingsChange('3', '0'))
    await waitFor(() => expect(mocks.search).toHaveBeenCalledTimes(3))
    expect(mocks.search.mock.calls[2][2]).toMatchObject({ mode: '3', sortMode: '0', offset: 0 })
  })

  it.each(['search', 'page', 'recommendations'] as const)('aborts %s on unmount without publishing a late result', async (kind) => {
    const pending = deferred()
    const { result, unmount, onResults } = setup()
    if (kind === 'recommendations') {
      mocks.recommendations.mockReturnValueOnce(pending.promise)
      act(() => { void result.current.loadClientRecommendations() })
    } else if (kind === 'page') {
      mocks.search.mockResolvedValueOnce([product('a')]).mockReturnValueOnce(pending.promise)
      act(() => result.current.handleQueryChange('parts'))
      await waitFor(() => expect(result.current.results).toHaveLength(1))
      act(() => { void result.current.loadMoreResults() })
    } else {
      mocks.search.mockReturnValueOnce(pending.promise)
      act(() => result.current.handleQueryChange('parts'))
    }
    const calls = kind === 'recommendations' ? mocks.recommendations.mock.calls : mocks.search.mock.calls
    const signal = calls.at(-1)![2].signal as AbortSignal
    onResults.mockClear()
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve([product('late')]))
    expect(onResults).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })
})
