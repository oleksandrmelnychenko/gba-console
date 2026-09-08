// Synthetic receipt proof for pre-existing UI/arithmetic fixtures. Actual producer
// serialization and tampering are tested separately in api/procurementCost*.test.ts.
import type { ProcurementCostContext, ProcurementCostProvenance } from './procurementCostTypes'
import type { ReorderSuggestion } from './procurementTypes'
import { decimalParts } from './procurementDecimals'

const basis = 'net_goods_excluding_vat_delivery_customs' as const
const productIds = [...Array.from({ length: 500 }, (_, i) => i + 1), 29383589, 29390942, 29484594, 90000001, 90000002]
export function fixtureCostContext(asOf = '2026-06-15', certified = true): ProcurementCostContext & { history_scope: 'demand' } {
  const fingerprint = 'd'.repeat(64)
  const request = { as_of_exclusive: asOf, history_days: 365, product_ids: [...productIds], supplier_id: null, version: 1 as const }
  // Precomputed SHA256 of this exact synthetic scope; independently verified by the API tests.
  const hashes: Record<string, string> = {"2026-06-15": "615282b2158e6dff47dae61b8efa98ba6d099daeff951af54cc59af9392e1456", "2026-07-25": "924f523973b5dbecdbcfea93d0d1c3ae8e61ddae73e06fa5417cedacee168d51"}
  const componentId = hashes[asOf]
  if (!componentId) throw new Error('Unsupported synthetic observation date')
  const start = new Date(`${asOf}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 365)
  return { history_scope: 'demand', cost_total_basis: basis, cost_totals_certified: certified,
    cost_observation_manifest: { version: 1, scope: 'CurrentPostedReceipts', resolver_version: 'current-posted-receipt-cost-v1',
      basis, statistic: 'observation_median_half_up_4', snapshot_relationship: 'single_snapshot', components: [{
        component_id: componentId, ...request, fingerprint,
        effective_start_date: start.toISOString().slice(0, 10) < '2025-01-01' ? '2025-01-01' : start.toISOString().slice(0, 10),
        observation_started_at_utc: `${asOf}T10:00:00.0000000Z`, observation_completed_at_utc: `${asOf}T10:00:01.0000000Z`,
        publications: [{ for_amg: false, receipt_id: '11111111-1111-4111-8111-111111111111', committed_at_utc: `${asOf}T09:00:00.0000000Z`,
          validated_at_utc: `${asOf}T10:00:00.5000000Z`, contract_version: 'fixture-v1', canonical_chain_sha256: 'e'.repeat(64) }],
      }] } }
}

export function fixtureCostProof(unit: number | null = 6, quantity = 1, line: number | null = unit,
  asOf = '2026-06-15'): ProcurementCostProvenance {
  const known = unit !== null
  const exclusions = quantity <= 0 ? ['no_positive_suggested_quantity'] : []
  if (!known) exclusions.push('no_observations', 'verified_cost_unavailable')
  else if (line === null) exclusions.push('line_amount_precision_unsupported')
  const parts = unit === null ? null : decimalParts(unit)
  const digits = parts?.coefficient.toString().padStart((parts?.scale ?? 0) + 1, '0') ?? ''
  const canonical = parts === null ? null : parts.scale ? `${digits.slice(0, -parts.scale)}.${digits.slice(-parts.scale)}` : digits
  if (parts && parts.scale > 4) return { version: 1, source: 'buyer_supplied', scope: 'BuyerSupplied', resolver_version: null,
    basis: 'buyer_tax_basis_unverified', statistic: 'buyer_override', canonical_unit_cost_eur: canonical, current_unit_ids: [], supplier_client_agreement_ids: [],
    observation_count: 0, known_count: 0, unknown_count: 0, coverage: 'buyer_supplied', reason_counts: [], aggregation_reason: null, component_refs: [],
    budget_eligible: false, budget_exclusion_reasons: ['buyer_tax_basis_unverified', ...(quantity <= 0 ? ['no_positive_suggested_quantity'] : [])] }
  return { version: 1, source: 'receipt_history', scope: 'CurrentPostedReceipts', resolver_version: 'current-posted-receipt-cost-v1',
    basis, statistic: 'observation_median_half_up_4', canonical_unit_cost_eur: canonical,
    current_unit_ids: known ? [1] : [], supplier_client_agreement_ids: known ? [7001] : [],
    observation_count: known ? 1 : 0, known_count: known ? 1 : 0, unknown_count: 0, coverage: known ? 'complete' : 'no_observations',
    reason_counts: [], aggregation_reason: null,
    component_refs: [fixtureCostContext(asOf).cost_observation_manifest.components[0].component_id],
    budget_eligible: exclusions.length === 0, budget_exclusion_reasons: exclusions }
}

export function fixtureLineCostFields(row: Record<string, unknown> = {}): Pick<ReorderSuggestion,
  'cost_provenance' | 'sale_price_basis' | 'margin_unavailable_reason' | 'service_level_basis' | 'budget_priority_weight'> {
  const quantity = typeof row.suggested_qty === 'number' ? row.suggested_qty : 1
  const unit = row.unit_cost_eur === null ? null : typeof row.unit_cost_eur === 'number' ? row.unit_cost_eur : 6
  const line = row.line_cost_eur === null ? null : typeof row.line_cost_eur === 'number' ? row.line_cost_eur : unit
  const weights: Record<string, number> = { critical: 1, high: .7, normal: .4, none: .1 }
  return { cost_provenance: fixtureCostProof(unit, quantity, line),
    sale_price_basis: row.unit_sale_eur === null ? 'unavailable' : 'historical_recorded_tax_basis_unverified',
    margin_unavailable_reason: 'sale_tax_basis_unverified', service_level_basis: 'abc_fallback_with_optional_producer_floor',
    budget_priority_weight: quantity <= 0 ? 0 : weights[typeof row.urgency === 'string' ? row.urgency : 'critical'] }
}

export const fixtureNoBudget = { budget_basis: basis, budget_objective: null, budget_score: null, value_captured_eur: null }
