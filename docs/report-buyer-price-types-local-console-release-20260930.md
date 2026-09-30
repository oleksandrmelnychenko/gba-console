# Buyer price types: local Console release handoff

## Scope and prerequisite

The client commercial structure page now shows a read-only table of standard
and promotional price types from the opened client's synchronized Fenix
agreements. It uses the existing `GET /clients/get/commercial-structure`
response and does not call 1C or a report snapshot. This is local evidence for
one client, not execution or parity of the source-free 1C constructor
«Типы цен покупателей».

Deploy server projection commit `937f9f2c9` before the Console feature. It
adds `Buyer` to each projected `ClientSourceCardSnapshot`. An older server
omits that property; the Console then explains that buyer evidence is
unavailable and suppresses the table. No database migration or new sync pass
is required for this projection.

The table requires one target card and one Fenix snapshot with a valid source
identity, `Buyer=true`, no deletion or truncation, a valid snapshot date, and
complete buyer agreements. Each displayed agreement has an exact unique
16-byte source reference and a standard price type. Its period must cover the
snapshot day; source-deleted and other known agreement kinds are excluded.
Malformed dates, unknown kinds, missing references, and incomplete price data
suppress the table with a visible reason. The local view grants no new report
or identity-management permission.

## Offline verification

- `vitest` for `ClientCommercialStructureView.test.tsx`: 15 passed, including
  target scope, incomplete evidence, and malformed agreement timestamp.
- `npm run build`: passed; build ID `2026.09.30.0308`.
- `eslint` on changed feature files: no issues.
- React Doctor scoped to the two new edits after `06d0b58b`: 100/100, no
  findings. Broad branch scan against `origin/main` reports 89/100 with
  pre-existing findings in unrelated report and product files.
- Built client structure chunk:
  `ClientCommercialStructureView-Cr_NazTH.js`, SHA-256
  `6d63743d5c5fb90696029690c0ead5e79fb35562ee77dc2602c09b975afc28eb`.

## Authenticated DEV smoke after server and Console deployment

1. Open one known synchronized Fenix buyer card in the Console's client
   structure page. Confirm the table names only that card's current buyer
   agreements, displays standard/promotional type and snapshot time, and has
   no rows from related cards or expired agreements.
2. Open a card with no Fenix buyer evidence. Confirm a visible unavailable
   message and no table.
3. Compare the API response for the first card to the local table, including
   `Buyer`, `SourceReference`, `AgreementType`, `FromDate`, `ToDate`, and
   `LastSeenAtUtc`. Keep the native 1C constructor marked captured until its
   own source and parity evidence exists.

No authenticated DEV smoke or deployment was performed in this handoff.
