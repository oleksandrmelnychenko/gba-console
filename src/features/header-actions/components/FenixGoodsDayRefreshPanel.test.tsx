import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, ApiError } from '../../../shared/api/apiClient'
import { AuthContext } from '../../auth/AuthContext'
import type { AuthContextValue } from '../../auth/types'
import { GOODS_REFRESH_TIMEOUT_MS, goodsRefreshMessage, isClosedGoodsDay, parseGoodsRefreshResult,
  refreshGoodsDay, todayInKyiv } from '../goodsDayRefresh'
import { FenixGoodsDayRefreshPanel } from './FenixGoodsDayRefreshPanel'
import { SyncControl } from './SyncControl'
import { getSyncStatus, startDailySync, startSyncSession } from '../api/syncApi'

vi.mock('../../../shared/api/apiClient', async (original) => ({
  ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn(),
}))
vi.mock('../../../shared/i18n/useI18n', () => {
  const t = (text: string) => text
  return { useI18n: () => ({ t }) }
})
vi.mock('../api/syncApi', async (original) => ({
  ...await original<typeof import('../api/syncApi')>(), getSyncStatus: vi.fn(),
  startDailySync: vi.fn(), startSyncSession: vi.fn(),
}))

const DAY = '2026-09-12'
const BUTTON = 'Оновити класифікацію товарів за добу'
function reply(status = 2, reason = 0) {
  return { Status: status, ClosedKyivDay: DAY, Reason: reason,
    NativeSaleImportRequested: false, HistoricalXlsParityVerified: false, AllReportsReady: false,
    Refresh: status === 2 ? { KyivDay: DAY, Status: 2, FactCount: 27, ProductKeyCount: 27,
      ElapsedMs: 4000, CompleteCurrentNativeCensusVerified: true, CompleteSourceCatalogue: false,
      WholeSourceSalesDayVerified: false, HistoricalXlsParityVerified: false, SourceWrites: 0 } : null }
}
function auth(allowed = true, user = 'private-user-a'): AuthContextValue {
  return { session: { userNetUid: user }, user: null, isAuthenticated: true,
    isLoading: false, isPermissionsLoading: false, permissions: [], hasPermission: () => allowed,
    login: vi.fn(), logout: vi.fn() }
}
function panel(overrides: Partial<Parameters<typeof FenixGoodsDayRefreshPanel>[0]> = {}, session = auth()) {
  return <MantineProvider env="test"><AuthContext.Provider value={session}>
    <FenixGoodsDayRefreshPanel visible mode="daily" source="fenix" range={{ from: DAY, to: DAY }}
      blocked={false} onPendingChange={vi.fn()} {...overrides} />
  </AuthContext.Provider></MantineProvider>
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => { resolve = accept })
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-27T12:00:00Z'))
  vi.mocked(apiRequest).mockReset().mockResolvedValue(reply())
  vi.mocked(getSyncStatus).mockReset().mockResolvedValue({ InMemorySynchronizationInProgress: false,
    IsGlobalLockHeld: false, IsGlobalLockStatusAvailable: true, IsInProgress: false })
  vi.mocked(startDailySync).mockReset()
  vi.mocked(startSyncSession).mockReset()
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('exact classification response and calendar', () => {
  it('uses Kyiv midnight rather than the browser local day and refuses open/invalid days', () => {
    const midnight = new Date('2026-09-26T21:30:00Z')
    expect(todayInKyiv(midnight)).toBe('2026-09-27')
    expect(isClosedGoodsDay('2026-09-26', midnight)).toBe(true)
    for (const day of ['2026-09-27', '2026-09-28', '2026-02-30', '1899-12-31', '9999-01-01', '2026-9-12'])
      expect(isClosedGoodsDay(day, midnight)).toBe(false)
  })
  it.each([0, 1, 2, 3])('decodes numeric advisory status %i without promoting readiness', (status) => {
    const value = parseGoodsRefreshResult(reply(status, status === 3 ? 9 : 0), DAY)
    expect(value.Status).toBe(status)
    expect(value).not.toHaveProperty('AllReportsReady')
  })
  it.each(Array.from({ length: 12 }, (_, reason) => reason))('handles server reason %i with bounded text', (reason) => {
    const value = parseGoodsRefreshResult(reply(0, reason), DAY)
    expect(goodsRefreshMessage(value)).toBeTruthy()
  })
  it.each([
    { Status: 4 }, { Status: 'Completed' }, { Reason: 12 }, { ClosedKyivDay: '2026-09-13' },
    { NativeSaleImportRequested: true }, { HistoricalXlsParityVerified: true }, { AllReportsReady: true },
    { Refresh: null },
  ])('refuses a mismatched or inflated advisory %j', (change) => {
    expect(() => parseGoodsRefreshResult({ ...reply(), ...change }, DAY)).toThrow()
  })
  it.each([
    { Status: 0 }, { FactCount: 20001 }, { FactCount: -1 }, { FactCount: '27' }, { FactCount: 2.5 },
    { ProductKeyCount: 1025 }, { ProductKeyCount: 28 }, { ElapsedMs: 90000 }, { SourceWrites: 1 },
    { CompleteCurrentNativeCensusVerified: false }, { CompleteSourceCatalogue: true },
    { WholeSourceSalesDayVerified: true }, { HistoricalXlsParityVerified: true },
    { KyivDay: '2026-09-13' }, { Status: 1 },
  ])('refuses unsafe summary %j', (change) => {
    expect(() => parseGoodsRefreshResult({ ...reply(), Refresh: { ...reply().Refresh, ...change } }, DAY)).toThrow()
  })
  it('accepts empty days only with zero counts; does not credit a disabled summary', () => {
    const empty = { ...reply(), Refresh: { ...reply().Refresh, Status: 1, FactCount: 0, ProductKeyCount: 0 } }
    expect(parseGoodsRefreshResult(empty, DAY).Refresh?.Status).toBe(1)
    expect(() => parseGoodsRefreshResult({ ...reply(0), Refresh: reply().Refresh }, DAY)).toThrow()
  })
})

describe('one explicit request', () => {
  it('blocks the existing native start button during classification without starting native sync', async () => {
    const response = deferred<unknown>()
    vi.mocked(apiRequest).mockReturnValue(response.promise)
    render(<MantineProvider env="test"><AuthContext.Provider value={auth()}><SyncControl /></AuthContext.Provider></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: '1С синхронізація' }))
    await waitFor(() => expect(getSyncStatus).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('radio', { name: /Щоденна/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'FENIX' }))
    fireEvent.change(screen.getByLabelText('Дата від'), { target: { value: DAY } })
    fireEvent.change(screen.getByLabelText('Дата до'), { target: { value: DAY } })
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    expect((screen.getByRole('button', { name: 'Запустити щоденну синхронізацію' }) as HTMLButtonElement).disabled).toBe(true)
    expect(startDailySync).not.toHaveBeenCalled()
    expect(startSyncSession).not.toHaveBeenCalled()
    await act(async () => response.resolve(reply()))
    expect((screen.getByRole('button', { name: 'Запустити щоденну синхронізацію' }) as HTMLButtonElement).disabled).toBe(false)
    expect(startDailySync).not.toHaveBeenCalled()
    expect(startSyncSession).not.toHaveBeenCalled()
    expect(apiRequest).toHaveBeenCalledOnce()
  })
  it('sends the exact new POST and does not read on mount or double-click', async () => {
    const response = deferred<unknown>()
    vi.mocked(apiRequest).mockReturnValue(response.promise)
    const busy = vi.fn()
    render(panel({ onPendingChange: busy }))
    expect(apiRequest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    expect(apiRequest).toHaveBeenCalledOnce()
    expect(apiRequest).toHaveBeenCalledWith('/data/sync/online-shop-seo/report-goods/refresh-day', expect.objectContaining({
      method: 'POST', signal: expect.any(AbortSignal),
      query: { closedKyivDay: DAY, forAmg: false, type: 'Sales' },
    }))
    expect(busy).toHaveBeenCalledWith(true)
    await act(async () => response.resolve(reply()))
    expect(screen.getByRole('status').textContent).toContain('Оновіть звіт')
    expect(busy).toHaveBeenLastCalledWith(false)
  })
  it.each([
    { visible: false }, { mode: 'full' as const }, { source: 'amg' as const },
  ])('does not offer the action outside the authorized Fenix daily panel %j', (props) => {
    render(panel(props))
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
    expect(apiRequest).not.toHaveBeenCalled()
  })
  it('hides it without permission and while permissions are loading', () => {
    const view = render(panel({}, auth(false)))
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
    view.rerender(panel({}, { ...auth(), isPermissionsLoading: true }))
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
    expect(apiRequest).not.toHaveBeenCalled()
  })
  it.each([
    { range: { from: DAY, to: '2026-09-13' } },
    { range: { from: '2026-09-27', to: '2026-09-27' } }, { blocked: true },
  ])('refuses multi-day, open-day or synchronization-busy selection %j', (props) => {
    render(panel(props))
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    expect(apiRequest).not.toHaveBeenCalled()
  })
  it.each([5, 7, 9])('explains disabled/busy/refused server reason %i without retry', async (reason) => {
    vi.mocked(apiRequest).mockResolvedValue(reply(reason === 9 ? 3 : 0, reason))
    render(panel())
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    await screen.findByRole('status')
    expect(screen.getByRole('status').textContent).toBe(goodsRefreshMessage(parseGoodsRefreshResult(reply(reason === 9 ? 3 : 0, reason), DAY)))
    expect(apiRequest).toHaveBeenCalledOnce()
  })
  it('treats a lost response as unknown, without trusting arbitrary error text or retrying', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('private server detail'))
    render(panel())
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    await screen.findByRole('status')
    expect(screen.getByRole('status').textContent).toContain('Результат оновлення не підтверджено')
    expect(screen.queryByText('private server detail')).toBeNull()
    expect(apiRequest).toHaveBeenCalledOnce()
  })
  it('reports an explicit permission refusal safely', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('private text', 403, null))
    render(panel())
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    await screen.findByRole('status')
    expect(screen.getByRole('status').textContent).toContain('Немає дозволу')
    expect(apiRequest).toHaveBeenCalledOnce()
  })
  it.each(['day', 'permission', 'user', 'closed'] as const)('discards late response after scope change: %s', async (change) => {
    const response = deferred<unknown>()
    vi.mocked(apiRequest).mockReturnValue(response.promise)
    const view = render(panel())
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    const signal = vi.mocked(apiRequest).mock.calls[0][1]?.signal
    view.rerender(panel(change === 'day' ? { range: { from: '2026-09-13', to: '2026-09-13' } }
      : change === 'closed' ? { visible: false } : {}, change === 'permission' ? auth(false)
        : change === 'user' ? auth(true, 'private-user-b') : auth()))
    expect(signal?.aborted).toBe(true)
    await act(async () => response.resolve(reply()))
    expect(screen.queryByRole('status')).toBeNull()
    expect(apiRequest).toHaveBeenCalledOnce()
  })
  it('ignores a wrong-day successful HTTP reply', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...reply(), ClosedKyivDay: '2026-09-13' })
    render(panel())
    fireEvent.click(screen.getByRole('button', { name: BUTTON }))
    await screen.findByRole('status')
    expect(screen.getByRole('status').textContent).toContain('не підтверджено')
    expect(apiRequest).toHaveBeenCalledOnce()
  })
  it('enforces a 110-second client deadline with one POST and clears its timer', async () => {
    vi.useFakeTimers()
    vi.mocked(apiRequest).mockImplementation((_path, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const request = refreshGoodsDay(DAY, new AbortController().signal)
    const rejected = expect(request).rejects.toThrow('Aborted')
    await vi.advanceTimersByTimeAsync(GOODS_REFRESH_TIMEOUT_MS - 1)
    expect(vi.mocked(apiRequest).mock.calls[0][1]?.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejected
    expect(apiRequest).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects bad calendar and pre-aborted calls before POST', async () => {
    await expect(refreshGoodsDay('2026-09-27', new AbortController().signal)).rejects.toThrow()
    const controller = new AbortController(); controller.abort()
    await expect(refreshGoodsDay(DAY, controller.signal)).rejects.toThrow()
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
