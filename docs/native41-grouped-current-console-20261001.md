# Current grouped settlement Console

The separate server `groupedSettlementPeriod` capability admits the existing
Dataset41 ordinary current-buyer route. New drafts on that server start with
explicit `GroupedSettlementPeriod` version1, Fenix, SettlementCurrency and the
exact current Buyers subtree. An older server keeps the previous exact-agreement
form. No permission, dataset ID, login or Source request is added.

The form offers current buyer agreements or one exact agreement, Fenix/AMG,
organization / currency / counterparty and organization / counterparty layouts,
current native organization/buyer/ClientAgreement/currency include/exclude
choices and the separately advertised AND/OR filter tree. The two workbook
shortcuts choose their actual layouts; `ДБіторка.xls` is offered only with the
new capability. Both samples explicitly filter Buyers, as pinned in the server
workbook metadata. Arbitrary captured source-group include/exclude choices are
not silently reinterpreted as local IDs; their follow-up remains explicit.

Unavailable period values and dependent totals stay blank. Unresolved group
membership is labelled; different settlement currencies are not added. Today's
ordinary request is admitted and delegates exact financial coverage to OUR.
The exact saved route keeps its completed-day rule and fixed four-level layout.

Saved omission/null does not select grouped mode or acquire a fresh Buyers
filter. Mode changes are explicit. Raw aliases and unsupported versions are
preserved for validation; double aliases are refused. Layout presets preserve
the existing calculation and selectors. Drafts, updates, recovery, preview and
ordinary XLSX/PDF runs include the same group scope, filters and layout in their
request and cancellation fingerprint. The API clones the request before await;
changing layout or world clears stale file links.

Dataset35 numeric operational basis0 remains0; its visible label and workbook
notice now describe sales minus returns for the period, matching backend
`c5489a490ddec620fbd1ba871fe7ef068123a875`. The explicit signed daily basis1
and saved omission/null calculation remain unchanged.

Authored regressions cover strict capabilities, both new workbook layouts,
saved exact omission/null submit and update, precise native filters and boolean
trees, today's request, preview/export capture, group/world fingerprint changes,
and stale XLSX/PDF cancellation. Existing legacy41 tests remain applicable.
**The child ran no build, test, lint, Doctor, browser, SQL or Source operation.
Root owns those checks, including the React Doctor score gate.**
