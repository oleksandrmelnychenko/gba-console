import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../shared/api/apiClient'
import { getProducerPlan } from './api/procurementApi'
import raw from './api/cost-fixtures/producer.json'
import { procurementBasketCost, procurementCostSnapshotKey } from './procurementBasketCost'

vi.mock('../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('restores factual zero only with the current exact snapshot and line proof; stale and legacy costs stay unknown', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  const plan = await getProducerPlan(7), current = plan.items[0]
  const key = procurementCostSnapshotKey(plan)!
  const saved = JSON.parse(JSON.stringify({ suggestion: current, qty: .021, costSnapshotKey: key }))
  expect(procurementBasketCost(saved, current, key)).toEqual({ proofCurrent: true, amount: 0 })
  const changed = structuredClone(plan)
  changed.cost_observation_manifest.components[0].component_id = 'f'.repeat(64)
  expect(procurementBasketCost(saved, current, procurementCostSnapshotKey(changed))).toEqual({ proofCurrent: false, amount: null })
  delete saved.costSnapshotKey
  expect(procurementBasketCost(saved, current, key)).toEqual({ proofCurrent: false, amount: null })
  expect(saved.qty).toBe(.021)
  expect(saved.suggestion.product_id).toBe(current.product_id)
})

it('does not reprice or replace a saved selection when a current product exists with different evidence', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  const plan = await getProducerPlan(7), current = plan.items[1], key = procurementCostSnapshotKey(plan)!
  const saved = { suggestion: structuredClone(current), qty: .021, costSnapshotKey: key }
  saved.suggestion.cost_provenance.supplier_client_agreement_ids = [9999]
  const original = structuredClone(saved)
  expect(procurementBasketCost(saved, current, key).amount).toBeNull()
  expect(saved).toEqual(original)
  expect(procurementBasketCost(saved, undefined, key).amount).toBeNull()
  expect(procurementBasketCost(saved, current, null).amount).toBeNull()
})
