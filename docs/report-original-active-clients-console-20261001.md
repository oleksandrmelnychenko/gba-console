# Original active-clients constructor: Console delivery

Base Console commit: `b78ec9ef3f28108bb18408a4d057038b7b4ec1a1`.
This additive route launches `Количество активных клиентов` from its exact
Fenix catalogue identity. It does not alias native datasets 12/13 or modify
the debt-to-sales constructor.

## Contract

- `GET /report/constructors/active-clients/capabilities` confirms the exact
  source identity, executable capability, monthly period, offset −1 and four
  original columns.
- `POST /report/constructors/active-clients/preview` sends only `Version`,
  `SourceIdentity` and `Month` (`yyyy-MM`). Its one result supplies the four
  scalar cells and both XLSX/PDF links under the existing authenticated caller.
- The exact definition hash is
  `e0521154862cbf0bba9f9e5d3c99c4d18f7e6a22715accb8280e40f11809feed`.
- Column order/captions: `Текущее значение`, `Предыдущее значение`,
  `Изменение %`, `Изменение (абс)`.

The original form has no product/client/agreement/native-dataset selectors.
The dedicated capability remains usable if the numeric dataset catalogue
fails. The permission and exact capability checks remain required.

## Current OUR semantics

The server returns distinct current OUR clients over eligible posted sale
and return lines for each calendar month. Console retains the explicit
`CurrentOurClient` basis and `SourceParityVerified=false`; it does not
promote current local results to independent Source population parity.

Observed-empty inputs remain zero. Missing client attribution remains NULL
in dependent cells with a readable availability notice. A known previous
zero can still produce the server's known percent 100 independently of an
unavailable current input. Console never recalculates these cells.

Values stay decimal strings. Percent is rounded only for two-place screen
presentation; the raw result value, result hashes and server XLSX/PDF links
are preserved. Shared existing helpers provide calendar boundaries and
decimal presentation only, without changing ratio arithmetic.

The monthly form uses the existing report-run invalidation hook. A month,
permission, capability or current caller change clears its cells and export
links; a late result from the previous scope is ignored. Original launches
do not rewrite native report drafts.

## Validation ownership

Nineteen focused cases were authored across these five files:

- `src/features/reports/data/activeClients.test.ts` (6);
- `src/features/reports/api/activeClientsApi.test.ts` (3);
- `src/features/reports/pages/ActiveClientsCatalogueLaunch.test.tsx` (3);
- `src/features/reports/pages/ActiveClientsReportPanel.test.tsx` (5);
- `src/features/reports/pages/ReportsStocksPage.activeClients.test.tsx` (2).

Coverage includes exact source/month/column binding, observed empty versus
unattributed inputs, percent raw precision, one-result exports, late caller
and permission invalidation, original draft isolation and launch while the
numeric catalogue is unavailable.

The agent performed static source/contract review and `git diff --check`
only. Root owns the focused Vitest run, affected catalogue/debt-ratio
regression cases, lint, TypeScript/Vite build and React Doctor comparison
against the base commit. No npm, browser, HTTP, Docker, SQL, Source, build
or test command was executed by the agent. Integration and release remain
pending those actual Root results.
