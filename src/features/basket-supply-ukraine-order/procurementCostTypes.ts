export type ProcurementCostPublication = {
  for_amg: boolean
  receipt_id: string
  committed_at_utc: string
  contract_version: string
  canonical_chain_sha256: string
  validated_at_utc: string
}

export type ProcurementCostComponent = {
  component_id: string
  version: 1
  product_ids: number[]
  supplier_id: number | null
  as_of_exclusive: string
  history_days: number
  effective_start_date: string
  observation_started_at_utc: string
  observation_completed_at_utc: string
  fingerprint: string
  publications: ProcurementCostPublication[]
}

export type ProcurementCostManifest = {
  version: 1
  scope: 'CurrentPostedReceipts'
  resolver_version: 'current-posted-receipt-cost-v1'
  basis: 'net_goods_excluding_vat_delivery_customs'
  statistic: 'observation_median_half_up_4'
  snapshot_relationship: 'single_snapshot' | 'separate_snapshots' | 'empty_scope'
  components: ProcurementCostComponent[]
}

export type ProcurementCostProvenance = {
  version: 1
  source: 'receipt_history' | 'buyer_supplied'
  scope: 'CurrentPostedReceipts' | 'BuyerSupplied'
  resolver_version: string | null
  basis: 'net_goods_excluding_vat_delivery_customs' | 'buyer_tax_basis_unverified'
  statistic: 'observation_median_half_up_4' | 'buyer_override'
  canonical_unit_cost_eur: string | null
  current_unit_ids: number[]
  supplier_client_agreement_ids: number[]
  observation_count: number
  known_count: number
  unknown_count: number
  coverage: 'complete' | 'partial' | 'unknown' | 'no_observations' | 'buyer_supplied'
  reason_counts: { reason: string; count: number }[]
  aggregation_reason: 'mixed_current_units' | 'cost_float_precision_unsupported' | null
  component_refs: string[]
  budget_eligible: boolean
  budget_exclusion_reasons: string[]
}

export type ProcurementCostContext = {
  cost_observation_manifest: ProcurementCostManifest
  cost_total_basis: 'net_goods_excluding_vat_delivery_customs' | 'includes_buyer_values_with_unverified_tax_basis'
  cost_totals_certified: boolean
}
