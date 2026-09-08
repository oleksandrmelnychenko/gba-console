import type { ProcurementCostContext } from './procurementCostTypes'
import type { ReorderSuggestion } from './procurementTypes'
import type { ProcurementSessionBasketLine } from './procurementSessions'
import { exactDisplayedLineAmount } from './procurementDecimals'

/** Bounded financial identity; component IDs bind every exact request/fingerprint.
 * Read timestamps may change on a financially identical observation. */
export function procurementCostSnapshotKey(context: ProcurementCostContext | null): string | null {
  if (!context) return null
  const manifest = context.cost_observation_manifest
  return JSON.stringify({ version: manifest.version, scope: manifest.scope, resolver_version: manifest.resolver_version,
    basis: manifest.basis, statistic: manifest.statistic, snapshot_relationship: manifest.snapshot_relationship,
    components: manifest.components.map(component => component.component_id) })
}

/** Saved quantities remain user-owned. Never reprice an old basket implicitly. */
export function procurementBasketCost(line: ProcurementSessionBasketLine, current: ReorderSuggestion | undefined,
  snapshotKey: string | null): { proofCurrent: boolean; amount: number | null } {
  const saved = line.suggestion
  const proofCurrent = Boolean(snapshotKey && line.costSnapshotKey === snapshotKey && current && saved.cost_provenance
    && saved.product_id === current.product_id && saved.producer_id === current.producer_id
    && saved.unit_cost_eur === current.unit_cost_eur
    && JSON.stringify(saved.cost_provenance) === JSON.stringify(current.cost_provenance))
  return { proofCurrent, amount: proofCurrent && saved.unit_cost_eur !== null ? exactDisplayedLineAmount(saved.unit_cost_eur, line.qty) : null }
}
