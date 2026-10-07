# QA1274 cash Excel shortcut

The cash workbook's retained row order is account/cashbox, cash kind,
organization (`40,44,43`). Its attachment SHA-256 is
`59dbf9eda0ce22269e43ce35edf83ed41caa0e06cdc895fa08dad28a3ab57492`.
Current-data acceptance requires the form and calculation with OUR synced data.

The existing API already advertises both the detailed cash layout
`43,40,42,41` and this workbook layout. Its grouped cash projection preserves
each account/currency register leg and unavailable amounts. The Console already
offers a manual layout choice, but the Excel shortcut previously called only
the ordinary default builder, opening the detailed layout.

The shortcut now applies the exact sample rows when the live server advertises
the complete two-layout capability, a valid grouped cash selector and each of
the three unique selectable axes. The row captions use the same current
dataset metadata as the ordinary form. Missing, malformed or older capability,
missing/disabled/duplicate axis and a scalar account request cannot opt in.

Ordinary dataset defaults and saved requests keep their existing meaning.
Settlement shortcuts retain their separate currency-axis presentation. The
cash selector, eight measures, existing filters, dates, currency witnesses,
NULL propagation and permissions are unchanged; no Source/API/schema/sync
behavior or report availability is added.

The authored focused cases cover the supported sample request, detached input,
old/malformed capability, incomplete axes, scalar/default requests and both
settlement forms. Root must run the focused Console tests, changed-file lint,
TypeScript/Vite build and React Doctor comparison. No SDK/npm/browser/SQL or
runtime operation was performed by the author. Current authenticated preview
and XLSX/PDF acceptance still require a genuine session and existing complete
OUR cash publications.
