# Procurement cost observations

The producer plan, warehouse/cart plan and dashboard require the same version 1 current posted receipt manifest. Historical coverage describes demand only (`history_scope: demand`); inventory, reservations and purchase costs are explicitly outside that historical state claim.

The API rejects missing or contradictory cost proof before displaying a plan. Every receipt line resolves to its own product/supplier component, whose SHA256 binds the exact request and financial fingerprint. Components retain separate read intervals and publication identities. Publication validation stays within its component interval; the approved publication clock allowance is five minutes after read completion. No browser-clock freshness rule or joint atomic snapshot is inferred.

Receipt cost is an observation median, rounded half up to four decimals, for goods excluding VAT, delivery and customs. It is not a future payment or current contract quote. Partial medians stay visible with incomplete coverage and cannot enter the automatic budget. Buyer-supplied estimates retain their values but have no inherited receipt or tax proof. Unknown amounts remain blank; confirmed zero remains numeric zero. A positive recommended quantity with a complete verified zero cost is eligible. A zero quantity has weight zero and is excluded.

The budget objective is the dimensionless sum of selected-line urgency weights (`urgency_weighted_lines`). It does not represent profit or EUR value. Historical sale tax basis is unverified, so margin, ROI/value density and captured profit remain null. Existing draft creation still sends exact supplier/product identities and the selected quantities; the order service determines its own contract and price.

Historical supplier comparisons require usable receipt medians on both sides, a different exact supplier, and an alternative strictly below the base and at least 2% lower. Decimal coefficients establish the threshold. Partial comparison coverage is disclosed; no current offer is implied.

Saved basket quantities and identities remain unchanged. A restored cost needs the exact current financial snapshot signature and the matching supplier/product line proof. Missing legacy proof, changed components, or changed scalar/proof makes the basket estimate and totals unknown; it never silently reprices a selection. Draft requests contain no estimated price.

The constructor exports coverage, source, cost basis, eligibility and exclusion reasons alongside each estimate. It preserves unknown monetary cells and canonical fractional quantities. HTTP 503 remains an unavailable response with retry guidance, rather than an empty successful plan.

Tests include four unmodified synthetic fixtures serialized by the Python producer, plus strict tampering, independent publication intervals, seven-digit timestamps, zero/partial/buyer cases, exact alternative boundaries, unsupported numeric line extensions, UI labels and existing fractional-quantity/draft-request regressions. These fixtures contain no real customer names or credentials. Live acceptance requires a separately approved deployment.
