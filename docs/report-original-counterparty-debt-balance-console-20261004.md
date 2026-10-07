# Exact Fenix counterparty-debt Console delivery

Own original0e9ed1d2, Organization→Counterparty, default management indicator,
optional signed settlement indicator. Two current OUR human equality filters and an
explicit whole-second balance endpoint/switch. Screen/CSV/XLSX/PDF share one completed
validated result; no source calls, FX inference or native parity claim.

New focused test files: originalCounterpartyDebt.test.ts,
originalCounterpartyDebtApi.test.ts, OriginalCounterpartyDebtPanel.test.tsx,
OriginalCounterpartyDebtCatalogueLaunch.test.tsx. Existing test bodies are unchanged.
Root-only focused command (under its original owned runtime controller):

```sh
rtk proxy npm exec -- vitest run src/features/reports/data/originalCounterpartyDebt.test.ts src/features/reports/api/originalCounterpartyDebtApi.test.ts src/features/reports/pages/OriginalCounterpartyDebtPanel.test.tsx src/features/reports/pages/OriginalCounterpartyDebtCatalogueLaunch.test.tsx src/features/reports/pages/ReportCataloguePanel.test.tsx
```

Root also owns changed-file eslint, cached full build and React Doctor diff against873391b.
All definitions are authored, unexecuted. Source/native/current normal scope,
source-date/saved-switch acceptance and source parity remain unmeasured.
