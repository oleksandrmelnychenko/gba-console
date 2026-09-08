import { describe, expect, it } from 'vitest'
import producer from './cost-fixtures/producer.json'
import { normalizeProcurementCosts } from './procurementCostContract'
import { normalizeCostProvenance } from './procurementCostProvenance'

const error = (path: string, reason: string) => new Error(`${path}: ${reason}`)
const normalize = (data: typeof producer) => normalizeProcurementCosts(data, 'plan', data.as_of_date, error)

describe('actual Python synthetic receipt-cost proof serialization', () => {
  it('retains the exact component identity, observation precision, complete factual zero, partial median and isolated buyer input', async () => {
    const costs = await normalize(producer)
    expect(costs.cost_observation_manifest).toEqual(producer.cost_observation_manifest)
    const proofs = producer.items.map(item => normalizeCostProvenance(item.cost_provenance,
      { productId: item.product_id, supplierId: item.producer_id, unit: item.unit_cost_eur, line: item.line_cost_eur, quantity: item.suggested_qty },
      costs.cost_observation_manifest, 'line', error))
    expect(proofs.map(item => [item.coverage, item.budget_eligible])).toEqual([
      ['complete', true], ['complete', true], ['partial', false], ['buyer_supplied', false], ['unknown', false],
    ])
    expect(proofs[0].canonical_unit_cost_eur).toBe('0.0000')
    expect(proofs[2].canonical_unit_cost_eur).toBe('10.0000')
    expect(proofs[3].component_refs).toEqual([])
    expect(proofs[4].canonical_unit_cost_eur).toBeNull()
  })
  it('refuses changed financial fingerprint without a matching exact request identity', async () => {
    const data = structuredClone(producer); data.cost_observation_manifest.components[0].fingerprint = 'e'.repeat(64)
    await expect(normalize(data)).rejects.toThrow('does not bind the exact request and financial fingerprint')
  })
  it('refuses a line reference from another manifest or product even if its money happens to match', async () => {
    const costs = await normalize(producer), item = producer.items[0]
    expect(() => normalizeCostProvenance(item.cost_provenance, { productId: 999, supplierId: item.producer_id, unit: 0, line: 0, quantity: 40 }, costs.cost_observation_manifest, 'line', error)).toThrow('another product or supplier scope')
    expect(() => normalizeCostProvenance({ ...item.cost_provenance, component_refs: ['f'.repeat(64)] },
      { productId: item.product_id, supplierId: item.producer_id, unit: 0, line: 0, quantity: 40 }, costs.cost_observation_manifest, 'line', error)).toThrow('another product or supplier scope')
  })
  it('refuses partial coverage promoted into the automatic budget and buyer input inheriting receipt identities', async () => {
    const costs = await normalize(producer)
    for (const index of [2, 3]) {
      const item = producer.items[index], proof = { ...item.cost_provenance, budget_eligible: true, component_refs: producer.items[0].cost_provenance.component_refs }
      expect(() => normalizeCostProvenance(proof, { productId: item.product_id, supplierId: item.producer_id,
        unit: item.unit_cost_eur, line: item.line_cost_eur, quantity: item.suggested_qty }, costs.cost_observation_manifest, 'line', error)).toThrow()
    }
  })
  it('retains independent read intervals for the same immutable publication, rejecting a changed receipt chain', async () => {
    const raw = structuredClone(producer)
    const original = raw.cost_observation_manifest.components[0]
    const components = await Promise.all([1, 2].map(async (id) => {
      const fingerprint = original.fingerprint
      const request = { as_of_exclusive: raw.as_of_date, history_days: original.history_days, product_ids: [id], supplier_id: null, version: 1 }
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ fingerprint, request })))
      const componentId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      return { ...original, ...request, component_id: componentId,
        observation_started_at_utc: `2026-09-08T10:0${id}:00.0000001Z`, observation_completed_at_utc: `2026-09-08T10:0${id}:01.0000007Z`,
        publications: original.publications.map(proof => ({ ...proof, committed_at_utc: '2026-09-08T09:00:00.0000000Z',
          validated_at_utc: `2026-09-08T10:0${id}:00.0000002Z` })) }
    }))
    Object.assign(raw.cost_observation_manifest, { components, snapshot_relationship: 'separate_snapshots' })
    expect((await normalize(raw)).cost_observation_manifest.components).toEqual(components)
    components[1].publications[0].canonical_chain_sha256 = 'f'.repeat(64)
    await expect(normalize(raw)).rejects.toThrow('contradictory financial proof')
  })
  it('validates all seven timestamp digits and the approved five-minute publication clock allowance', async () => {
    const raw = structuredClone(producer), c = raw.cost_observation_manifest.components[0]
    c.observation_started_at_utc = '2026-09-08T10:00:00.0000001Z'
    c.observation_completed_at_utc = '2026-09-08T10:00:01.0000007Z'
    c.publications[0].validated_at_utc = '2026-09-08T10:00:00.0000002Z'
    c.publications[0].committed_at_utc = '2026-09-08T10:05:01.0000007Z'
    await expect(normalize(raw)).resolves.toBeDefined()
    c.publications[0].committed_at_utc = '2026-09-08T10:05:01.0000008Z'
    await expect(normalize(raw)).rejects.toThrow('observation bounds')
    c.publications[0].committed_at_utc = '2026-09-08T09:00:00Z'
    c.publications[0].validated_at_utc = '2026-09-08T10:00:00.0000000Z'
    await expect(normalize(raw)).rejects.toThrow('observation bounds')
  })
})
