import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { CASH_MOVEMENT_DEFINITIONS, createCashMovementRequest } from '../data/cashMovement'
import { CASH_MOVEMENT_TEST_CALLER, cashMovementCapability, cashMovementReport } from '../data/cashMovement.test-fixtures'
import { getCashMovementCapabilities, previewCashMovement } from './cashMovementApi'
vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest), fetchMock = vi.fn()
function response(report = cashMovementReport()) { return new Response(JSON.stringify({ Body: report }), { headers: { 'Content-Type': 'application/json',
  'Gba-Report-Request-Sha256': report.RequestSha256, 'Gba-Report-Result-Sha256': report.ResultSha256 } }) }
beforeEach(() => { api.mockReset(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession({ userNetUid: CASH_MOVEMENT_TEST_CALLER, csrfToken: 'cash-csrf' }) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })
it.each(['receipts', 'payouts'] as const)('uses exact %s capability and one preview with caller cancellation', async kind => {
  const capability = cashMovementCapability(kind), report = cashMovementReport(kind), controller = new AbortController()
  api.mockResolvedValueOnce(capability); fetchMock.mockResolvedValueOnce(response(report))
  expect(await getCashMovementCapabilities(kind, controller.signal)).toEqual(capability)
  expect(await previewCashMovement(capability, report.Period, CASH_MOVEMENT_TEST_CALLER, controller.signal)).toEqual(report)
  expect(api).toHaveBeenCalledWith(`${CASH_MOVEMENT_DEFINITIONS[kind].Route}/capabilities`, { signal: controller.signal, dedupe: false })
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(new URL(url).pathname).toBe(`/api/v1/uk${CASH_MOVEMENT_DEFINITIONS[kind].Route}/preview`)
  expect(options).toMatchObject({ method: 'POST', signal: controller.signal, credentials: 'include', cache: 'no-store' })
  expect(JSON.parse(options.body as string)).toEqual(createCashMovementRequest(capability, report.Period))
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('rejects wrong capability and invalid period before submission', async () => {
  api.mockResolvedValueOnce(cashMovementCapability('payouts'))
  await expect(getCashMovementCapabilities('receipts')).rejects.toThrow('цієї форми')
  api.mockReset(); const signal = new AbortController().signal
  await expect(previewCashMovement({ ...cashMovementCapability(), Executable: false }, '2026-Q3', CASH_MOVEMENT_TEST_CALLER, signal)).rejects.toThrow('Сервер не підтвердив')
  await expect(previewCashMovement(cashMovementCapability(), '2026-09', CASH_MOVEMENT_TEST_CALLER, signal)).rejects.toThrow('Оберіть допустимий')
  expect(fetchMock).not.toHaveBeenCalled()
})
it('refuses stale periods and does not retry an ambiguous or refused calculation', async () => {
  const signal = new AbortController().signal; fetchMock.mockResolvedValueOnce(response(cashMovementReport('receipts', '2026-Q2')))
  await expect(previewCashMovement(cashMovementCapability(), '2026-Q3', CASH_MOVEMENT_TEST_CALLER, signal)).rejects.toThrow('іншу форму чи період')
  fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
  await expect(previewCashMovement(cashMovementCapability(), '2026-Q3', CASH_MOVEMENT_TEST_CALLER, signal)).rejects.toMatchObject({ status: 503 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
