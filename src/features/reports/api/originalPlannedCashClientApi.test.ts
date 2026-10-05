import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { clientCapability, clientResult, flowCapability, flowResult } from '../testing/originalPlannedCashClientFixtures'
import { clientRequest } from '../data/originalClientReport'
import { plannedFlowDefaults, plannedFlowRequest } from '../data/originalPlannedCashFlow'
import { getClientReportCapability, readClientReport } from './originalClientReportApi'
import { getPlannedFlowCapability, readPlannedFlow } from './originalPlannedCashFlowApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('own E124 exact routes use required empty arrays dedupefalse and original signal', async () => {
  vi.clearAllMocks(); const controller = new AbortController(), request = plannedFlowRequest(flowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults)
  vi.mocked(apiRequest).mockResolvedValueOnce(flowCapability).mockResolvedValueOnce(flowResult())
  await getPlannedFlowCapability(controller.signal); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/planned-cash-flow/capabilities?world=fenix', { signal: controller.signal })
  await readPlannedFlow(request, controller.signal); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/planned-cash-flow/preview', { method: 'POST', body: request, dedupe: false, signal: controller.signal })
})
it('own fb9 routes do not use other statements choices APIs or add unsupported witness request fields', async () => {
  vi.clearAllMocks(); const controller = new AbortController(), request = clientRequest(clientCapability, '2026-10-01', '2026-10-04')
  vi.mocked(apiRequest).mockResolvedValueOnce(clientCapability).mockResolvedValueOnce(clientResult())
  await getClientReportCapability(controller.signal); expect(apiRequest).toHaveBeenLastCalledWith('/report/original-client-report/capabilities', { signal: controller.signal })
  await readClientReport(request, controller.signal); expect(apiRequest).toHaveBeenLastCalledWith('/report/original-client-report/preview', { method: 'POST', body: request, dedupe: false, signal: controller.signal })
})
