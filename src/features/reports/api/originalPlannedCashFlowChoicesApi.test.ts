import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { readPlannedFlowChoices } from './originalPlannedCashFlowApi'
import { plannedFlowDefaults, plannedFlowRequest } from '../data/originalPlannedCashFlow'
import { namedFlowCapability, plannedFlowChoices } from '../testing/originalPlannedCashFlowChoiceFixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('own name scope uses POST exact body caller signal no query selectors and no request deduplication', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(plannedFlowChoices())
  const request = plannedFlowRequest(namedFlowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults), controller = new AbortController()
  expect((await readPlannedFlowChoices(request, controller.signal)).Fields[0].Available).toBe(true)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/planned-cash-flow/choices', { method: 'POST', body: request, dedupe: false, signal: controller.signal })
})
