import { requireAiIsoDate } from '../../../shared/ai/aiHistoryLineage'
import type { ProcurementCostComponent, ProcurementCostContext, ProcurementCostManifest, ProcurementCostPublication } from '../procurementCostTypes'

export type CostContractError = (path: string, reason: string) => Error
const DAY = 86_400_000
const HASH = /^[a-f0-9]{64}$/
const UTC = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(?:Z|\+00:00)$/
export const NET_GOODS = 'net_goods_excluding_vat_delivery_customs'
export const COST_RESOLVER = 'current-posted-receipt-cost-v1'
export const COST_MEDIAN = 'observation_median_half_up_4'

export function costRequire(condition: unknown, path: string, reason: string, error: CostContractError): asserts condition {
  if (!condition) throw error(path, reason)
}
export function costRecord(value: unknown, path: string, error: CostContractError): Record<string, unknown> {
  costRequire(value && typeof value === 'object' && !Array.isArray(value), path, 'must be an object', error)
  return value as Record<string, unknown>
}
export function costArray(value: unknown, path: string, error: CostContractError, maximum = 100_000): unknown[] {
  costRequire(Array.isArray(value) && value.length <= maximum, path, 'must be a bounded array', error)
  return value
}
export function costText(value: unknown, path: string, error: CostContractError): string {
  costRequire(typeof value === 'string' && value.trim().length > 0 && value.length <= 1000, path, 'must be a bounded nonempty string', error)
  return value
}
export function costCount(value: unknown, path: string, error: CostContractError, maximum = 50_000): number {
  costRequire(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum, path, 'must be a bounded nonnegative integer', error)
  return value
}
export function costIds(value: unknown, path: string, error: CostContractError, maximum = 50_000): number[] {
  const ids = costArray(value, path, error, maximum).map((id, index) => {
    costRequire(typeof id === 'number' && Number.isSafeInteger(id) && id > 0, `${path}[${index}]`, 'must be an exact positive identifier', error)
    return id
  })
  costRequire(ids.every((id, index) => index === 0 || id > ids[index - 1]), path, 'must contain distinct sorted identifiers', error)
  return ids
}
export function costHash(value: unknown, path: string, error: CostContractError): string {
  costRequire(typeof value === 'string' && HASH.test(value), path, 'must be a canonical SHA256 identifier', error)
  return value
}
function utcTicks(value: unknown, path: string, error: CostContractError): bigint {
  const text = costText(value, path, error), match = UTC.exec(text)
  costRequire(match, path, 'must retain a valid UTC timestamp with at most seven fractional digits', error)
  requireAiIsoDate(match[1], path, error)
  const [hour, minute, second] = match.slice(2, 5).map(Number)
  costRequire(hour < 24 && minute < 60 && second < 60, path, 'invalid UTC time', error)
  return BigInt(Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`)) * 10_000n + BigInt((match[5] ?? '').padEnd(7, '0'))
}

function publication(value: unknown, path: string, started: bigint, completed: bigint, error: CostContractError): ProcurementCostPublication {
  const data = costRecord(value, path, error)
  costRequire(typeof data.for_amg === 'boolean', `${path}.for_amg`, 'must be a boolean', error)
  const receipt = costText(data.receipt_id, `${path}.receipt_id`, error)
  costRequire(/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(receipt), `${path}.receipt_id`, 'must be an exact publication UUID', error)
  const committed = utcTicks(data.committed_at_utc, `${path}.committed_at_utc`, error)
  const validated = utcTicks(data.validated_at_utc, `${path}.validated_at_utc`, error)
  costRequire(started <= validated && validated <= completed && committed <= completed + 300n * 10_000_000n, path, 'publication timestamps contradict observation bounds', error)
  return { for_amg: data.for_amg, receipt_id: receipt, committed_at_utc: data.committed_at_utc as string,
    validated_at_utc: data.validated_at_utc as string, contract_version: costText(data.contract_version, `${path}.contract_version`, error),
    canonical_chain_sha256: costHash(data.canonical_chain_sha256, `${path}.canonical_chain_sha256`, error) }
}

async function component(value: unknown, path: string, asOf: string, error: CostContractError): Promise<ProcurementCostComponent> {
  const data = costRecord(value, path, error)
  costRequire(data.version === 1, `${path}.version`, 'unsupported version', error)
  const products = costIds(data.product_ids, `${path}.product_ids`, error, 1000)
  costRequire(products.length > 0, `${path}.product_ids`, 'component scope cannot be empty', error)
  const supplier = data.supplier_id
  costRequire(supplier === null || typeof supplier === 'number' && Number.isSafeInteger(supplier) && supplier > 0, `${path}.supplier_id`, 'must be null or an exact supplier identifier', error)
  const day = requireAiIsoDate(data.as_of_exclusive, `${path}.as_of_exclusive`, error)
  costRequire(day === asOf && Number(day.slice(0, 4)) <= 9998, `${path}.as_of_exclusive`, 'does not match the bounded plan business date', error)
  const days = costCount(data.history_days, `${path}.history_days`, error, 540)
  costRequire(days >= 1, `${path}.history_days`, 'history must contain at least one day', error)
  const start = requireAiIsoDate(data.effective_start_date, `${path}.effective_start_date`, error)
  const expected = new Date(Math.max(Date.parse('2025-01-01T00:00:00Z'), Date.parse(`${day}T00:00:00Z`) - days * DAY)).toISOString().slice(0, 10)
  costRequire(start === expected && start < day, `${path}.effective_start_date`, 'does not match the bounded current receipt scope', error)
  const started = utcTicks(data.observation_started_at_utc, `${path}.observation_started_at_utc`, error)
  const completed = utcTicks(data.observation_completed_at_utc, `${path}.observation_completed_at_utc`, error)
  costRequire(started <= completed, path, 'observation ends before it starts', error)
  const fingerprint = costHash(data.fingerprint, `${path}.fingerprint`, error)
  const id = costHash(data.component_id, `${path}.component_id`, error)
  const canonical = JSON.stringify({ fingerprint, request: { as_of_exclusive: day, history_days: days, product_ids: products, supplier_id: supplier, version: 1 } })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  costRequire(actual === id, `${path}.component_id`, 'does not bind the exact request and financial fingerprint', error)
  return { component_id: id, version: 1, product_ids: products, supplier_id: supplier, as_of_exclusive: day, history_days: days,
    effective_start_date: start, observation_started_at_utc: data.observation_started_at_utc as string,
    observation_completed_at_utc: data.observation_completed_at_utc as string, fingerprint,
    publications: costArray(data.publications, `${path}.publications`, error).map((item, index) => publication(item, `${path}.publications[${index}]`, started, completed, error)) }
}

function uniqueScopes(components: ProcurementCostComponent[], path: string, error: CostContractError) {
  const ids = new Set<string>(), products = new Set<number>(), publications = new Map<string, string>()
  for (const item of components) {
    costRequire(!ids.has(item.component_id), path, 'duplicate component identity', error); ids.add(item.component_id)
    for (const product of item.product_ids) {
      costRequire(!products.has(product), path, 'a product cannot inherit overlapping component scopes', error); products.add(product)
    }
    const ownPublications = new Set<string>()
    for (const proof of item.publications) {
      const id = proof.receipt_id.toLowerCase(), signature = JSON.stringify({ for_amg: proof.for_amg, receipt_id: id, committed_at_utc: proof.committed_at_utc, contract_version: proof.contract_version, canonical_chain_sha256: proof.canonical_chain_sha256 })
      costRequire(!ownPublications.has(id), path, 'duplicate publication within component', error); ownPublications.add(id)
      costRequire(!publications.has(id) || publications.get(id) === signature, path, 'publication identity has contradictory financial proof', error)
      publications.set(id, signature)
    }
  }
}

export async function normalizeProcurementCosts(data: Record<string, unknown>, path: string, asOf: string, error: CostContractError): Promise<ProcurementCostContext> {
  const manifestPath = `${path}.cost_observation_manifest`, raw = costRecord(data.cost_observation_manifest, manifestPath, error)
  costRequire(raw.version === 1 && raw.scope === 'CurrentPostedReceipts' && raw.resolver_version === COST_RESOLVER
    && raw.basis === NET_GOODS && raw.statistic === COST_MEDIAN, manifestPath, 'unsupported cost observation contract', error)
  const components = await Promise.all(costArray(raw.components, `${manifestPath}.components`, error, 100)
    .map((value, index) => component(value, `${manifestPath}.components[${index}]`, asOf, error)))
  uniqueScopes(components, manifestPath, error)
  const relationship = components.length === 0 ? 'empty_scope' : components.length === 1 ? 'single_snapshot' : 'separate_snapshots'
  costRequire(raw.snapshot_relationship === relationship, `${manifestPath}.snapshot_relationship`, 'must describe the actual independent component collection', error)
  costRequire(data.cost_total_basis === NET_GOODS || data.cost_total_basis === 'includes_buyer_values_with_unverified_tax_basis', `${path}.cost_total_basis`, 'unsupported cost total basis', error)
  costRequire(typeof data.cost_totals_certified === 'boolean', `${path}.cost_totals_certified`, 'must be a boolean', error)
  costRequire(!data.cost_totals_certified || data.cost_total_basis === NET_GOODS, `${path}.cost_totals_certified`, 'manual tax basis cannot certify a net-goods total', error)
  const manifest: ProcurementCostManifest = { version: 1, scope: 'CurrentPostedReceipts', resolver_version: COST_RESOLVER,
    basis: NET_GOODS, statistic: COST_MEDIAN, snapshot_relationship: relationship, components }
  return { cost_observation_manifest: manifest, cost_total_basis: data.cost_total_basis, cost_totals_certified: data.cost_totals_certified }
}
