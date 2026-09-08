import type { ProcurementCostManifest, ProcurementCostProvenance } from '../procurementCostTypes'
import { decimalParts } from '../procurementDecimals'
import { COST_MEDIAN, COST_RESOLVER, NET_GOODS, costArray, costCount, costHash, costIds, costRecord, costRequire, costText, type CostContractError } from './procurementCostContract'

type LineCost = { productId: number; supplierId: number; unit: number | null; line: number | null; quantity: number }
const EXCLUSIONS = new Set(['no_observations', 'incomplete_observation_coverage', 'mixed_current_units', 'cost_float_precision_unsupported',
  'verified_cost_unavailable', 'line_amount_precision_unsupported', 'buyer_tax_basis_unverified', 'no_positive_suggested_quantity'])

function strings(value: unknown, path: string, error: CostContractError): string[] {
  const result = costArray(value, path, error, 100).map((item, index) => costText(item, `${path}[${index}]`, error))
  costRequire(new Set(result).size === result.length, path, 'must contain unique values', error)
  return result
}
function canonicalCost(value: unknown, scalar: number | null, path: string, error: CostContractError): string | null {
  if (value === null) { costRequire(scalar === null, path, 'a displayed unit cost requires its exact canonical value', error); return null }
  costRequire(typeof value === 'string' && value.length <= 400 && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value), path, 'must retain a nonnegative invariant decimal string', error)
  if (scalar !== null) {
    const [whole, fraction = ''] = value.split('.'), coefficient = BigInt(whole + fraction), parsed = decimalParts(scalar)
    const scale = Math.max(fraction.length, parsed.scale)
    costRequire(coefficient * 10n ** BigInt(scale - fraction.length) === parsed.coefficient * 10n ** BigInt(scale - parsed.scale), path, 'displayed cost differs from its exact canonical proof', error)
  }
  return value
}
function reasons(value: unknown, observations: number, unknown: number, path: string, error: CostContractError) {
  const rows = costArray(value, path, error, 100).map((item, index) => {
    const raw = costRecord(item, `${path}[${index}]`, error)
    const reason = costText(raw.reason, `${path}[${index}].reason`, error), count = costCount(raw.count, `${path}[${index}].count`, error, observations)
    costRequire(count >= 1, `${path}[${index}].count`, 'a reason must describe at least one observation', error)
    return { reason, count }
  })
  costRequire(new Set(rows.map(item => item.reason)).size === rows.length, path, 'duplicate reason count', error)
  costRequire(unknown ? rows.reduce((sum, item) => sum + item.count, 0) >= unknown : rows.length === 0, path, 'unknown observation reasons are missing or contradictory', error)
  return rows
}

function receiptProof(proof: ProcurementCostProvenance, context: LineCost, manifest: ProcurementCostManifest, path: string, error: CostContractError) {
  costRequire(proof.scope === 'CurrentPostedReceipts' && proof.resolver_version === COST_RESOLVER && proof.basis === NET_GOODS
    && proof.statistic === COST_MEDIAN, path, 'receipt history lacks the required net-goods basis', error)
  costRequire(proof.component_refs.length === 1, `${path}.component_refs`, 'receipt scope requires one exact disjoint component', error)
  const component = manifest.components.find(item => item.component_id === proof.component_refs[0])
  costRequire(component && component.product_ids.includes(context.productId)
    && (component.supplier_id === null || component.supplier_id === context.supplierId), path, 'receipt proof belongs to another product or supplier scope', error)
  const coverage = proof.observation_count === 0 ? 'no_observations' : proof.unknown_count === 0 ? 'complete' : proof.known_count ? 'partial' : 'unknown'
  costRequire(proof.coverage === coverage, `${path}.coverage`, 'does not match observation counts', error)
  costRequire(proof.known_count ? proof.current_unit_ids.length > 0 && proof.supplier_client_agreement_ids.length > 0 && component.publications.length > 0
    : proof.current_unit_ids.length === 0 && proof.supplier_client_agreement_ids.length === 0 && proof.canonical_unit_cost_eur === null,
  path, 'known unit/agreement/publication evidence does not match observation coverage', error)
  if (proof.current_unit_ids.length > 1) costRequire(proof.aggregation_reason === 'mixed_current_units' && context.unit === null && proof.canonical_unit_cost_eur === null, path, 'mixed units cannot form a scalar unit cost', error)
  else if (proof.aggregation_reason === 'mixed_current_units') throw error(path, 'mixed-unit reason contradicts known units')
  if (proof.aggregation_reason === 'cost_float_precision_unsupported') costRequire(context.unit === null && proof.canonical_unit_cost_eur !== null, path, 'unsupported scalar precision must remain unavailable', error)
  if (proof.known_count > 0 && proof.current_unit_ids.length === 1 && proof.aggregation_reason === null) {
    costRequire(context.unit !== null && proof.canonical_unit_cost_eur !== null, path, 'a known scalar cannot be hidden without its precision reason', error)
  }
  if (proof.canonical_unit_cost_eur !== null) {
    costRequire((proof.canonical_unit_cost_eur.split('.')[1] ?? '').replace(/0+$/, '').length <= 4,
      path, 'receipt median exceeds the declared four-decimal statistic', error)
  }
  const expected = []
  if (context.quantity <= 0) expected.push('no_positive_suggested_quantity')
  if (coverage !== 'complete') expected.push(coverage === 'no_observations' ? 'no_observations' : 'incomplete_observation_coverage')
  if (proof.aggregation_reason) expected.push(proof.aggregation_reason)
  if (context.unit === null) expected.push('verified_cost_unavailable')
  else if (context.line === null) expected.push('line_amount_precision_unsupported')
  const exclusions = new Set(proof.budget_exclusion_reasons)
  costRequire(expected.length === exclusions.size && expected.every(reason => exclusions.has(reason)), path, 'budget exclusion reasons contradict available cost evidence', error)
  costRequire(proof.budget_eligible === (expected.length === 0) && (!proof.budget_eligible || proof.current_unit_ids.length === 1), path, 'budget eligibility requires complete verified scalar and line cost', error)
}

function buyerProof(proof: ProcurementCostProvenance, context: LineCost, path: string, error: CostContractError) {
  costRequire(proof.scope === 'BuyerSupplied' && proof.resolver_version === null && proof.basis === 'buyer_tax_basis_unverified'
    && proof.statistic === 'buyer_override' && proof.coverage === 'buyer_supplied', path, 'manual cost cannot inherit receipt tax proof', error)
  costRequire(proof.observation_count === 0 && proof.known_count === 0 && proof.unknown_count === 0 && proof.current_unit_ids.length === 0
    && proof.supplier_client_agreement_ids.length === 0 && proof.component_refs.length === 0 && proof.reason_counts.length === 0
    && proof.aggregation_reason === null, path, 'manual cost contains inherited observation identities', error)
  costRequire(context.unit !== null && proof.canonical_unit_cost_eur !== null && proof.budget_eligible === false
    && proof.budget_exclusion_reasons.includes('buyer_tax_basis_unverified')
    && proof.budget_exclusion_reasons.length === (context.quantity <= 0 ? 2 : 1)
    && (context.quantity > 0 || proof.budget_exclusion_reasons.includes('no_positive_suggested_quantity')), path, 'manual cost must remain visible with unverified tax basis and excluded from budget', error)
}

export function normalizeCostProvenance(value: unknown, context: LineCost, manifest: ProcurementCostManifest, path: string, error: CostContractError): ProcurementCostProvenance {
  const raw = costRecord(value, path, error)
  costRequire(raw.version === 1 && (raw.source === 'receipt_history' || raw.source === 'buyer_supplied'), path, 'unsupported line cost proof', error)
  const observations = costCount(raw.observation_count, `${path}.observation_count`, error), known = costCount(raw.known_count, `${path}.known_count`, error)
  const unknown = costCount(raw.unknown_count, `${path}.unknown_count`, error)
  costRequire(known + unknown === observations, path, 'known and unknown counts do not cover every observation', error)
  costRequire(raw.aggregation_reason === null || raw.aggregation_reason === 'mixed_current_units' || raw.aggregation_reason === 'cost_float_precision_unsupported', `${path}.aggregation_reason`, 'unsupported aggregation reason', error)
  costRequire(typeof raw.budget_eligible === 'boolean', `${path}.budget_eligible`, 'must be an explicit boolean', error)
  const exclusions = strings(raw.budget_exclusion_reasons, `${path}.budget_exclusion_reasons`, error)
  costRequire(exclusions.every(reason => EXCLUSIONS.has(reason)), `${path}.budget_exclusion_reasons`, 'unsupported budget exclusion reason', error)
  const refs = strings(raw.component_refs, `${path}.component_refs`, error).map((ref, index) => costHash(ref, `${path}.component_refs[${index}]`, error))
  const proof = { ...raw, version: 1, source: raw.source, canonical_unit_cost_eur: canonicalCost(raw.canonical_unit_cost_eur, context.unit, `${path}.canonical_unit_cost_eur`, error),
    observation_count: observations, known_count: known, unknown_count: unknown, current_unit_ids: costIds(raw.current_unit_ids, `${path}.current_unit_ids`, error),
    supplier_client_agreement_ids: costIds(raw.supplier_client_agreement_ids, `${path}.supplier_client_agreement_ids`, error),
    reason_counts: reasons(raw.reason_counts, observations, unknown, `${path}.reason_counts`, error), aggregation_reason: raw.aggregation_reason,
    component_refs: refs, budget_eligible: raw.budget_eligible, budget_exclusion_reasons: exclusions } as ProcurementCostProvenance
  if (proof.source === 'buyer_supplied') buyerProof(proof, context, path, error)
  else receiptProof(proof, context, manifest, path, error)
  return proof
}
