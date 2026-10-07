# Console: server attribution in native report preview

## Scope

The isolated Console worktree `console-report-attribution-20260927` starts at the accepted DEV revision `8680c593f13275921e51bda4fd39b7151500a553`. The change adds the visible **Про дані звіту** section to the existing inline preview. Dataset selection, report generation, screen cells, CSV/XLSX/PDF links, catalogue gates and server calculations retain their existing contracts.

The server already supplies `NativeReportInlineResult.Request` with actual display periods, applied and ignored filters, snapshot attribution and notes from the calculated pivot. The Console now validates and displays this description from the **same returned preview**, rather than reconstructing it from mutable form settings. It does not independently certify report completeness, historical readiness or parity.

## Presentation and validation

- Server period strings, such as `12.09.2026`, are preserved as display text. A period or comparison endpoint that was not supplied is described as missing.
- All server notes remain visible above the table. Dataset35's native/Goods coverage limits and dataset9's recorded-document versus warehouse-movement explanation can therefore be read before interpreting the figures.
- Ignored filters receive an explicit warning with the server's reason. Applied filters retain their field, condition, order and multiplicity. Captions are preserved; recognized raw GUID/hash values are replaced by `Обране точне значення`, and a numeric `[Id=...]` suffix is removed from an existing caption. Full original values remain in the validated in-memory result.
- Current snapshot wording appears only when `IsCurrentSnapshot` is true. Observation strings on another kind of report do not promote it to a current snapshot.
- Missing/null legacy `Request` has an explicit missing-description notice. Nullable lists remain unknown; they do not become observed empty filters, zero diagnostics or a completeness claim. Repeated notes are retained.
- Attribution uses React text nodes throughout. HTML-like server text cannot create elements or execute code. DataSource enum and request/result hashes are not displayed as product information.
- The normalizer matches the server's combined maximum of **4,096 list items**, including filter objects and filter values, and **65,536 strict UTF-8 bytes per string**. Unpaired UTF-16 surrogates, malformed booleans/arrays/filter entries and oversized combined lists refuse the preview. Attribution arrays and filter values are detached from the input object.

The existing result SHA field, sparse coordinate checks, explicit NULL marker and preview page bounds remain intact. The UI uses server attribution; it does not recreate or cryptographically recompute the server result digest.

## Owned files

| File | Purpose |
| --- | --- |
| `src/features/reports/data/nativeReportPreview.ts` | Typed and bounded server attribution transport |
| `src/features/reports/pages/ReportInlinePreview.tsx` | Visible notes, actual period and filter warnings |
| The corresponding two test files | Meaningful malformed transport, byte/item bounds, text-only rendering and semantic limits |
| `src/features/reports/pages/ReportsStocksPage.resultBinding.test.tsx` | Existing legacy preview fixture explicitly supplies nullable `Request` |
| This guide | Release scope and verification |

The [exact Fenix filter guide](report-exact-fenix-filters-console.md) continues to define filter authority. No unsupported historical cash, settlement, special report or source variant is enabled by this presentation change.

## Verification and release

Focused tests passed **27/27** across the normalizer and component. They include actual dataset35 note text, display dates, ignored reasons, caption retention without raw IDs, repeated notes, absent/nullable attribution, current-snapshot gating, HTML as text, the combined item limit, multibyte string limits and detached copies. A final run including the existing result-binding tests passed **31/31 across three files** after its legacy fixture explicitly supplied `Request: null`; that type-only fixture correction did not change the runtime code being tested by the complete report suite.

React Doctor **0.9.14** completed offline on the same two runtime files at the exact baseline and final candidate: **zero errors and one unchanged table-key warning in each**, with no skipped checks or new warning. Its initial candidate scan found render complexity in the attribution block; extracting pure view helpers resolved that warning before final verification. The installed CLI no longer accepts the skill's older `--diff` spelling; explicit file scopes supplied the equivalent bounded comparison. `--no-score` and `--no-supply-chain` prevented remote score/dependency API calls. No numeric health score is claimed.

The initial full report test attempt was stopped before that view split and receives no gate credit. The complete final report suite passed **3,486/3,486 tests across 170 files** with no failures (422.24 seconds). The two runtime files were unchanged throughout that run and the subsequent legacy-fixture correction. The final production build succeeded, transforming 10,842 modules; Vite retained its chunk-size advisory. The tested `dist` is frozen with build number `2026.09.27.report-attribution` and an exact file/hash manifest for deployment.

Root owns image assembly, DEV activation and authenticated browser/export verification; those actions are not claimed by this source change. The artifact uses `VITE_API_BASE_URL=/` and `VITE_API_LANGUAGE=uk`. Remaining public environment defaults match the baseline, including the relative realtime route. It contains no new Source, SQL, API, browser or Docker connection by the author.
