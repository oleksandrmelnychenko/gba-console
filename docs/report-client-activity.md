# Native sale-client activity in the console

Dataset 12 (`NativeSaleClientActivity`) offers the sole measure 25 (`DistinctSaleClientCount`), captioned **Унікальні клієнти (поточні прив’язки GBA)**. The preset uses month → client → client agreement and requires an explicit event period. Both dates survive switching through a current-state dataset. There is no implicit quantity unit, currency or valuation agreement.

This slice counts currently attributed native clients in posted sales. It does not certify historical source-buyer identity, the complete 1C sales-turnover register, return-adjusted purchasers or the source KPI’s previous-period/change outputs. Source migration parity status is unchanged.

Filters use the dataset’s native literal lookup. Contract selection retains exact `ClientAgreement.ID`, including separate bindings that share `Agreement.ID`. The native OR/AND tree, original selection indices, disabled selections, grouping order, measure ordering and private template revision survive save/apply/generate transport. Importing source 12 without its period/capabilities or with incompatible transformations refuses the operation before POST and retains the browser original. TOP, Threshold, ABC and HideZero remain unavailable for this nonadditive measure.

## Files and presentation

A native activity workbook must contain the exact title, period, UTC read interval, declared count measure and all five calculation-note prefixes. Its cells are either blank or exact nonnegative integers within the server’s 200,000-fact bound. Fractions, invalid numeric text and contradictory empty-state metadata are refused rather than rounded. Uploaded labels preserve the file’s stated context; they are not a new verification of its source.

The server owns set unions. For example, cells 2 and 2 can have grand total 3; even cells 2 and 2 with grand total 4 do not prove the measure additive. The viewer preserves server subtotals/grand totals and explicitly prevents local distinct-count recalculation. Narrowing ordinary data removes server totals; filtered CSV keeps the context without inventing a replacement count. Reimport remains nonadditive, even if no totals remain.

Known zero and unknown attribution remain different. A complete-empty report contains no client rows, retains the count column and confirmed grand 0, and states `Стан звіту: проведених продажів у вибраному обсязі немає`. A local filter cannot narrow that already empty set, so this state/grand pair remains unchanged through CSV. Unknown attribution instead remains blank in each affected leaf, subtotal and grand.

Charts plot each server leaf independently, exclude subtotal/grand rows and retain missing-value gaps. Count axes use integer ticks and count formatting. No client-side sums or unions are used for tables, CSV or charts.

## Validation scope

The report suite covers constructor defaults and switching, all five native lookups, two exact contract IDs sharing terms, OR/template preservation, imported incompatible options, cross-group union totals, accidental additive equality, unknown/zero/empty states, malformed metadata, binary XLSX import, CSV round-trips and all three chart styles. Previous eleven datasets, including contract valuation and the accepted TOP/Threshold/ABC/HideZero features, remain in regression scope.

Protected acceptance artifacts are kept under `/root/evidence/report-port-wave17-2026-09-08/client-activity-console/`. The full report suite passed 741 tests; build and full lint passed. Same-scope React Doctor scored 92 before/after on six existing production files; the new parser helper scored 100. Final focused tests also cover preserving the complete-empty state/grand under local filters. Three actual synthetic production-writer XLSX files also passed the same `read-excel-file` reader, CSV/chart checks, and frozen independent known2/2→grand3, unknown1/blank→grandblank and empty0-leaf→grand0 controls. Actual typed dataset capabilities produce the default [2,12,15] rows and measure25 while all four additive transformations remain unavailable. Initial fixture framing/caption mismatches and original files are preserved separately. Live deployment/UI acceptance remains on HOLD; no live GBA/SQL/1C/browser access is part of these console checks.
