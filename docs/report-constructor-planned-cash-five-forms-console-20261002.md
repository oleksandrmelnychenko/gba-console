# Original PlannedCash DEFAULT Console delivery

Parent Console: fb9bc35a122c613633245f055d4f70554d356fd0. Backend contract: 73d2054da225f3c7eb3618ca57ded5e614bd925c.

Five retained original catalogue identities use their own capabilities and preview routes under `/report/constructors/planned-cash/`: `dds-payouts`, `calendar-payouts`, `net-flow`, `dds-receipts`, `calendar-receipts`. Original titles, grouping and column order are separate. Version and opaque definition identity come from the actual server capability. The calendar receipts suggestion retains its quarter shape; calendar payouts and net flow suggest a month. Every period and plan endpoint is explicitly chosen, with an exclusive end. No native effective horizon is inferred.

Calendar payouts, calendar receipts and net flow bind strict local dates, server-formatted values, genuine counterparty labels or explicit missing captions, independent period/plan availability and same-run signed XLSX/PDF. Scope, permission and caller changes clear files and cancel old requests. Bounded streams retain the accepted session-generation checks, same-owner 401 refresh, body/header hashes and no retries after 409 or ambiguous writes. Financial calculations and exchange conversion are absent from the Console.

## Pending DDS scenario selection

The exact backend capability reports `ScenarioSelectionLabelsAvailable=false` and exposes no genuine scenario choices. Both DDS forms therefore open their current/previous date fields and an explicit pending notice, with generation disabled. There is no raw-reference input, fabricated scenario, implicit default or fake completed result.

The narrow backend completion contract needs an authenticated OUR scenario-choice catalogue: actual typed Scenario138 identity, canonical human label, unique opaque choice key and a capability/choice binding to the actual catalogue generation and caller. Only source-backed choices can supply the existing preview Scenario filter. The capability can advertise usable selection only after that mapping exists. The Console must then submit a selected server choice and invalidate it when the choice/caller binding changes. No Source query at report time is required by this design.

Cash-flow article labels remain explicitly pending where the server has no canonical mapping. Missing labels never become physical references or affect valid arithmetic. Additional saved filters/grouping/account-currency measures/document attributes and native parity are not accepted by this patch.

## Verification scope

Meaningful tests are authored for original identities/routes, strict dates, pending DDS selection, partial/empty/undefined values, signed server presentation, known currency-conflict transport, cookie/CSRF and response headers, old-owner streams, cancellation, same-run exports and native-workspace isolation. Author performed FILE/Git checks only. No build, tests, browser authorization, PDF conversion, normal publication, deployment or Source parity has been executed or accepted by this patch. Root owns all runtime checks.
