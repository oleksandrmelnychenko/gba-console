# Inventory turnover: Console delivery

This isolated successor starts from frozen Console
`250cd60bfd4beda1589025345628ae4f2890b08f` and binds the server contract from
`57fe22607b029c7e3b64d5f34c51c31f4e2d350b`. It adds one original monthly form
without changing other report transports, calculations or saved settings.
No author build, test, browser, Source, OUR, Docker or deployment action was run.

## Contract and user flow

The original catalogue entry is selected by its exact world/SourceId. The
launcher reads `report/constructors/inventory-turnover/capabilities` only after
the catalogue is mounted for an authorized current caller. It checks the actual
capability and any definition hash provided by the catalogue. A capability
definition is otherwise an opaque server binding; request `Version` and all
three `SourceIdentity` fields are copied from it, never recreated from a local
definition hash. Unsupported capability versions/settings remain unavailable.

The dedicated modal uses one `Month` filter and posts the exact immutable command
to `report/constructors/inventory-turnover/preview`. It preserves current and
previous local date-only windows, four original captions and the server's
`FormattedValue` strings. The browser performs no financial arithmetic or
rounding. Source raw unit annotations remain `(Упр)` and `(грн)` without FX or a
guessed local currency. Physical register, codec, schema and fraction evidence
are not shown in the product flow.

The result distinguishes pending sync, confirmed empty data, numeric zero,
undefined zero average and decimal projection failure. A proven cross-period
identity conflict retains the independently known scalar values and shows the
server's unavailable change cells. Genuinely incomplete current input can retain
the original independent previous-zero/NULL change guard supplied by the server.
Native virtual suppression, effective native periods and parity remain false.

The existing streaming client preserves cookies/CSRF, same-owner 401 refresh,
session generation and bounded JSON draining. Refused or ambiguous previews are
not automatically retried. Both report hash headers must match the body before
returning values/files. Caller/permission/capability/month changes and unmounting
invalidate old values and links and abort outstanding reads. XLSX/PDF links pass
through the existing export modal unchanged. A single preview supplies inline
values and its own caller-bound files.

Catalogue control closes only after the dedicated opener accepts the capability.
The normal native workspace dates, draft and generic generation path are kept
independent. No capability flag is forced true, and input availability is checked
by the server preview rather than assumed from a catalogue or native dataset.

## Authored cases, not execution evidence

| File | Declared cases |
| --- | ---: |
| data/inventoryTurnover.test.ts | 45 |
| api/inventoryTurnoverApi.test.ts | 18 |
| pages/InventoryTurnoverCatalogueLaunch.test.tsx | 8 |
| pages/InventoryTurnoverReportPanel.test.tsx | 16 |
| pages/ReportsStocksPage.inventoryTurnover.test.tsx | 3 |
| Total | 90 |

Cases cover opaque capability bindings, original captions/windows, independent
availability, generation conflicts, tampered metadata, exact hash headers,
conventional auth refresh, deferred stream ownership, malformed/oversized JSON,
explicit retry, cancellation, same-run files, permission changes, deferred
catalogue loading and native draft isolation. All 90 cases are authored and
unexecuted. Root runs the focused cases and relevant full Reports/lint/build/
cached React Doctor gates on the actual integrated candidate. Actual browser,
normal publication readiness and deployment remain independent acceptance.
