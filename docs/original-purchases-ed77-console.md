# Dedicated Fenix «Закупки» form

This separate Console child uses the server `OriginalPurchases` contract and
`docs/original-purchases-ed77-default.md` from server head
`ea236dc6321024df9423758cd28cbd2cff5676e4`. The source is
`ed77c5cc-6688-4316-a631-2ad0b237140d`, definition
`582aeeaf58b04b2234f9b73c3036045882b47d94165b3e47d70529b44520b241`.
Capability validation also binds module `01f65a3bdf8e7768e5c91619196a6fb1c0afe1da04b2e6b569b7a4449376d37a`,
UniversalReport module `c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17`,
and register `7a7763d1-6dbb-4f9d-abc7-75a12ad42db3`. No own query hash is invented.

The catalogue launch requires the exact Fenix source/definition and
`builtin:Закупки`. Neither an AMG alias nor the partial native incoming-receipt
dataset receives this launch. Discovery and preview retain the existing report
generation permission, caller identity and original abort signal. API routes are
GET `/report/originals/purchases/capabilities` and POST `/report/originals/purchases/preview`.

The hierarchy is status → counterparty → product. Only base quantity
(`КоличествоБазовыхЕд`) is initially selected. Raw quantity (`КоличествоОборот`)
and report-unit quantity (`КоличествоЕдиницОтчетов`) remain explicit options.
The five source fields are status, counterparty, product, division and project.
All remain visible and disabled while `HumanChoicesAvailable=false`; the default
request sends five empty selector arrays. Contracts preserve uppercase reference
keys and full project `TYPE:RTRef:RRRef` identity. No opaque key entry or synthetic
human choice is offered.

Response validation requires exact world/source/definition, dates, all five
selectors, resource order, local policies and complete three-level typed hierarchy.
Signed three-decimal strings are validated with BigInt; neither arithmetic nor
coefficient conversion occurs in the Console. Server rational parent rounding is
retained, including `0.333 + 0.333` children with a true `0.667` subtotal. Normal
contributing zero rows remain present. Complete empty data has authenticated zero
totals; missing data has no totals, rows or downloadable completed result.

Unavailable names render stable human ordinals in the completed hierarchy and
exports. Technical reference keys never become captions. CSV, XLSX and PDF use
the same detached completed result, selected quantities, dates and selector echo;
XLSX quantities remain strings. Changing dates, resources, caller or permission
clears the visible result and aborts pending preview/export delivery, including
return to the same caller after permission loss. Exports have a 1,000,000-cell cap.

Authored tests: 37 cases from 30 declarations in five new whole test files.
They cover exact launch/capability identity, resource defaults, all selectors,
compound project collisions, dates, hierarchy/zero policies, rational rounding,
missing versus complete empty, request detachment, original abort/caller handling,
same-result exports and cancelled deferred exports. All inherited test files and
shared grid/export code retain their bytes. Node, TypeScript, Vitest, lint, build,
React Doctor, browser and network were not executed by the author.

Source sync, current normal readiness, human choices, native date/Registrar/NULL/
zero suppression parity, browser/export runtime and full-original acceptance remain
unverified. The existing frozen Console1670 delivery and current DEV images are
unchanged. Root owns the subsequent focused quality workflow and any delivery.
