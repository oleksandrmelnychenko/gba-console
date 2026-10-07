# BUG-1274 main Console rollout

The six original XLS files specify current forms and filters; historical
amounts are not acceptance targets. The production Console exposes five source
report IDs through six shortcuts backed by datasets 35, 38, 39, 40 and 41.
Both settlement workbooks use dataset 41; «ДБіторка» is not the current-debt
report. Launches use the live server capabilities and the workbook builders,
including the extra display fields and both settlement row layouts.

Other implemented catalogue entries remain visible disabled with «Готово».
Captured-only and unassessed entries are hidden. Dataset selection, template
loading and generation enforce the same active dataset set. The reusable engine
can be exercised with an explicit consoleScope=false prop in engine tests;
actual routes use the restricted default. Register reports redirect to the
current workspace during this rollout. The old standalone turnover shortcut is
disabled with a ready chip.

The merged f7df6860 implementation restores the later period cash/settlement
forms and current product matrix omitted from the first main report release.
Later main bug fixes remain included.

Verification: production builds succeeded; the broad reports/routes suite
passed 6,321 tests with eight failures across three files. These rollout and
test-environment failures were corrected and verified with focused reruns.
React Doctor remained 88/100 compared with the observed integration baseline.

A fresh authenticated six-form browser run, current backend/image binding,
and same-generation Excel/PDF downloads remain acceptance requirements. Old
sessions fail normal refresh with «Refresh token invalid». The current SQL
verification is a production-repository and workbook-writer check, not a claim
of authenticated UI acceptance or complete source parity. 1C workers and
connections remain disabled.

The six production requests now generate previews and Excel workbooks on our
SQL. The checked supplier and selected-group matrix requests have defined
numeric values. The checked day-profit, cash and both settlement requests still
contain unknown values because the current synchronized data does not cover
their required classification or complete period publications. Generation
alone does not close BUG-1274; current data coverage and authenticated browser
downloads remain open.

Defined supplier and matrix values are not full calculation acceptance. The
checked supplier cost/profit unit is unverified, original storage-unit quantity
equivalence is open, and complete return profit needs exact return cost and
supplier attribution. The matrix's source stock formula and retained selector
mapping also remain open. The supplier measurement picker now follows the
selected calculation: ordinary signed quantity or saved register quantity.
Its typed request identifiers and saved calculation mode are preserved.

Six PDFs also passed the production converter in an isolated image without
network access. This does not prove Console download, visual layout or complete
numeric acceptance. The integrated code is pushed to main and built as Console
revision `753e7f19`, version `2026.10.07.0758`. The fresh API, Analytics and
Console image pins are prepared in the separate integrated release overlay.

DEV entered an independently configured `dev-full-reset-20261007-no-backups`
maintenance mode during release preparation. Its existing API runtime and
disabled background writers were restored; Analytics and Console remain
stopped. The new integrated release awaits maintenance clearance. It is not
claimed to be the active DEV Console. Current SQL and browser acceptance must
be repeated on the resulting synchronized database; previous receipts retain
their original observation scope.

The quantity-caption follow-up passed 50/50 focused Console tests, including
ordinary mode, saved legacy modes and explicit mode changes. Production build
succeeded. React Doctor scanned the same four changed files at the pre-fix
revision and current code: 93/100 in both runs, with the same five existing
issues. This comparison is separate from the earlier broader 88/100 scan.
