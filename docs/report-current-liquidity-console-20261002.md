# Current Liquidity original Console delivery — 2026-10-02

This isolated additive delivery starts at frozen Console AA
`aa3102e75d27aed36969de6570e3fd66dcc6a425`. Its Inventory files, shared stream,
authentication/session helpers, document modal, dependencies and existing tests
remain unchanged. Only the three existing catalogue/workspace wiring files gain
an additional original-constructor action.

## Actual backend contract

The implementation reads the frozen Liquidity delivery
`f2372a4fb0dc90b68786c138b81e2ddb7be6b1e5`, integrated as
`833e340cf92fbc9a9342d179d67061c8fede872d`.
The Root-owned focused gate actually passed 121 cases (65 reader + 56 delivery);
its receipt SHA256 is
`41433c92b65c9d8b2bb0a8534643a35590dcd13c46081beb506e14cfa9ddca4b`.
That is backend offline acceptance. Console execution, deployment, actual PDF
conversion, authenticated browser use and fresh normal publication are separate.

- GET `/report/constructors/current-liquidity/capabilities`.
- POST `/report/constructors/current-liquidity/preview`.
- Request: actual capability `Version` and `SourceIdentity`, `CurrentEndpoint`,
  `PreviousEndpoint`. No other business filters or invented observations.
- Both endpoints are strict `yyyy-MM-dd` first days of a month, with previous
  strictly before current, previous after `0001-01-01`, current before
  `3999-01-01`. Nonadjacent ordered endpoints are supported.
- Initial dates are the explicit GBA current local first of month and the prior
  first of month. They are user-editable choices, not historical native defaults.
- The four original server captions are `Текущее значение`,
  `Значение предыдущего периода`, `Изменение %`, `Изменение (абс)`.
- Every displayed value comes from server `FormattedValue`. Raw rational and
  monetary strings are validated as strings and never used for UI arithmetic.
- Resource annotations retain raw management sums/costs `(Упр)` and retail NTT
  amount `(грн)`, without a common-currency or FX claim.

## Availability and binding

The capability admits the implemented current OUR scope with
`SourceParityVerified=false`, `EffectiveSourcePeriodsVerified=false`,
`NativeVirtualTableZeroSuppressionVerified=false`, `AppliesFxConversion=false`.
Preview determines availability. A missing Warehouse named-status mapping can
leave six verified publications and an independent preceding scalar visible;
it does not turn the missing financial scalar into zero or discard all proof.
Known empty scalar SUM (available NULL), numeric zero, unavailable input and
an unrepresentable decimal remain different states. The server's independent
previous NULL/zero percentage100 is displayed even while current input is
missing. Proven cross-endpoint source-identity conflict preserves each scalar
and masks only change cells. The Console checks these envelope relationships,
not the source formula.

Authorization uses the existing stocks report-generate permission, actual
caller, cookies/CSRF and unchanged `apiStreamClient` generation checks during
fetch/body drain/refresh. Same-owner 401 refresh preserves command bytes;
changed caller or login generation rejects the old stream. Body is bounded to
1 MiB, hash headers bind the exact request/result envelope, unsafe/stale links
are rejected. Capability loading is deferred until opening the catalogue, and
late scopes/owners/permission changes cancel old requests and hide old values
and files. Same-run caller-signed XLSX/PDF URLs use the shared export modal.
No separate file generation, retry of ambiguous financial outcomes, Source
query, schema, normal-producer configuration or flag change is added here.

## Authored acceptance cases (not executed)

Five new test files declare **103** cases: data53, API20, launcher8, panel19,
workspace3. They cover strict endpoints/year edges, exact capability identity,
all original captions/units, unknown status versus pending versus confirmed
empty/zero, independent previous NULL/zero, projection overflow, generation
conflict, witness/header/date/file refusal, same-owner refresh/changed caller,
stream cancellation/body bounds and stale-owner/scope cleanup with same-run
exports. Root owns focused execution, full reports tests, lint/build and cached
Doctor comparison. No author build, test, npm/node, browser, SQL, Source, Docker
or runtime command was executed. Numerical parity and full-task acceptance are
not claimed.
